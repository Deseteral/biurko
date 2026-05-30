import {
  type CreateWindowOptions,
  RESIZE_DIRECTIONS,
  type WindowHandle,
  type WindowPositionStrategy,
  type WindowRect
} from "./types.ts";
import type {
  WindowClosedEventDetail,
  WindowFocusedEventDetail,
  WindowManagerEventMap,
  WindowOpenedEventDetail,
} from "./events.ts";
import {createDragState, type DragState} from "./drag-state.ts";
import {createResizeState, type ResizeState} from "./resize-state.ts";
import {applyResizeRegionStyles} from "./resize-region-styling.ts";

interface WindowState<AttachedDataT> {
  handle: WindowHandle;
  element: HTMLDivElement;
  surface: HTMLDivElement;
  title: string;
  data: AttachedDataT | undefined;
  dragRegionSelector: string;
  minWidth: number;
  minHeight: number;
  orderIdx: number;
}

const DEFAULT_RESIZE_REGION_SIZE = 6;

/** Configuration options for the {@link WindowManager} constructor. */
export interface WindowManagerOptions {
  /**
   * Size (in pixels) of the invisible resize hit regions placed around each window edge and corner.
   * A larger value makes it easier for users to grab the resize handles.
   *
   * @defaultValue `6`
   */
  resizeRegionSize?: number;

  /**
   * Strategy used to determine window position.
   *
   * @defaultValue `{ type: "required" }`
   */
  positionStrategy?: WindowPositionStrategy;
}

/**
 * Core window management class that handles window lifecycle and actions such as drag, resize, focus, and ordering.
 *
 * Dispatches typed events (see {@link WindowManagerEventMap}):
 *
 * @typeParam AttachedDataT - Optional data type attached to each window. Use `void` (default) if no
 *   data is needed.
 */
export class WindowManager<AttachedDataT = void> extends EventTarget {
  private readonly desktopElement: HTMLElement;
  private readonly windows: Map<WindowHandle, WindowState<AttachedDataT>> = new Map();
  private readonly dragState: DragState;
  private readonly resizeState: ResizeState;
  private readonly resizeRegionSize: number;
  private readonly positionStrategy: WindowPositionStrategy;

  /**
   * Creates a new WindowManager bound to the given container element.
   * The container acts as the "desktop" area where windows are positioned. A `biurko-desktop` CSS class
   * is added to it automatically.
   *
   * @param container - The DOM element that serves as the desktop area.
   * @param options - Optional configuration details.
   */
  constructor(container: HTMLElement, options?: WindowManagerOptions) {
    super();
    this.desktopElement = container;
    this.desktopElement.classList.add("biurko-desktop");
    this.resizeRegionSize = options?.resizeRegionSize ?? DEFAULT_RESIZE_REGION_SIZE;
    this.positionStrategy = options?.positionStrategy ?? {type: "required"};
    this.dragState = createDragState(this);
    this.resizeState = createResizeState(this);
  }

  /**
   * Creates a new window and appends it to the desktop container.
   * The window is automatically focused (brought to front) upon creation.
   * Dispatches a `"window-opened"` event.
   *
   * @param options - Configuration details (see {@link CreateWindowOptions}).
   * @param args - If `AttachedDataT` is not `void`, the attached data must be passed as the second argument.
   * @returns A unique {@link WindowHandle} identifying the created window.
   */
  public createWindow(options: CreateWindowOptions, ...args: AttachedDataT extends void ? [] : [data: AttachedDataT]): WindowHandle {
    const handle = crypto.randomUUID() as WindowHandle;
    const data = args[0] as AttachedDataT | undefined;
    const position = this.resolveInitialPosition(options.x, options.y);

    const element = document.createElement("div");
    element.dataset["windowHandle"] = handle;
    element.style.position = "absolute";
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.style.width = `${options.width}px`;
    element.style.height = `${options.height}px`;

    const surface = document.createElement("div");
    surface.classList.add("biurko-surface");
    surface.style.height = "100%";
    surface.style.overflow = "hidden";

    element.appendChild(surface);

    for (const direction of RESIZE_DIRECTIONS) {
      const resizeRegion = document.createElement("div");
      resizeRegion.dataset["resizeDirection"] = direction;
      applyResizeRegionStyles(resizeRegion, direction, this.resizeRegionSize);

      resizeRegion.addEventListener("mousedown", (e: MouseEvent): void => {
        e.stopPropagation();
        this.resizeState.start(handle, direction, e.clientX, e.clientY);
      });

      element.appendChild(resizeRegion);
    }

    this.desktopElement.appendChild(element);

    // Push all existing windows back by one.
    for (const state of this.windows.values()) {
      state.orderIdx += 1;
    }

    const dragRegionSelector = options.dragRegionSelector ?? "[data-biurko-drag-region]";

    const state: WindowState<AttachedDataT> = {
      handle,
      element,
      surface,
      title: options.title,
      data,
      dragRegionSelector,
      minWidth: options.minWidth ?? 0,
      minHeight: options.minHeight ?? 0,
      orderIdx: 0,
    };

    this.windows.set(handle, state);

    element.addEventListener("mousedown", (e: MouseEvent): void => {
      const target = e.target as Element | null;
      if (target?.closest(dragRegionSelector)) {
        this.dragState.start(handle, e.clientX, e.clientY);
      }
      this.focusWindow(handle);
    });

    this.applyZIndices();

    this.dispatchEvent(new CustomEvent<WindowOpenedEventDetail>("window-opened", {
      detail: {handle},
    }));

    return handle;
  }

  /**
   * Brings the specified window to front.
   * No-op if the window is already focused.
   * Dispatches a `"window-focused"` event.
   *
   * @param handle - The handle of the window to focus.
   */
  public focusWindow(handle: WindowHandle): void {
    const target = this.windows.get(handle);
    if (!target) return;
    if (target.orderIdx === 0) return;

    // Only windows that were in front of target need to shift back.
    for (const state of this.windows.values()) {
      if (state.handle === handle) continue;
      if (state.orderIdx >= target.orderIdx) continue;
      state.orderIdx += 1;
    }

    target.orderIdx = 0;
    this.applyZIndices();

    this.dispatchEvent(new CustomEvent<WindowFocusedEventDetail>("window-focused", {
      detail: {handle},
    }));
  }

  /**
   * Returns the handle of the currently focused window.
   *
   * @returns The {@link WindowHandle} of the focused window, or `null` if no windows are open.
   */
  public getFocusedWindow(): WindowHandle | null {
    for (const state of this.windows.values()) {
      if (state.orderIdx === 0) {
        return state.handle;
      }
    }
    return null;
  }

  /**
   * Closes and removes the window from the desktop.
   * The window's DOM element is removed and its internal state is cleaned up.
   * Dispatches a `"window-closed"` event.
   * No-op if the handle is invalid or its window is no longer open.
   *
   * @param handle - The handle of the window to close.
   */
  public closeWindow(handle: WindowHandle): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;

    windowState.element.remove();
    this.windows.delete(handle);

    // Shift all windows that were behind the closed one forward by one.
    for (const state of this.windows.values()) {
      if (state.orderIdx > windowState.orderIdx) {
        state.orderIdx -= 1;
      }
    }

    this.dispatchEvent(new CustomEvent<WindowClosedEventDetail>("window-closed", {
      detail: {handle},
    }));
  }

  /**
   * Returns the surface element (content container) for the given window.
   * This is the `HTMLDivElement` where you should render your window content.
   * It has the CSS class `biurko-surface`.
   *
   * @param handle - The window handle.
   * @returns The surface element, or `null` if the handle is invalid.
   */
  public getWindowSurface(handle: WindowHandle): HTMLDivElement | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;
    return windowState.surface;
  }

  /**
   * Returns the current title of the window.
   *
   * @param handle - The window handle.
   * @returns The title string, or `null` if the handle is invalid.
   */
  public getWindowTitle(handle: WindowHandle): string | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;
    return windowState.title;
  }

  /**
   * Updates the title of the window.
   * This only updates the internal state (see {@link getWindowTitle}).
   *
   * @param handle - The window handle.
   * @param title - The new title string.
   */
  public setWindowTitle(handle: WindowHandle, title: string): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;
    windowState.title = title;
  }

  /**
   * Returns the attached data for the given window.
   * The data type is determined by the `AttachedDataT` generic parameter.
   *
   * @param handle - The window handle.
   * @returns The attached data, or `null` if the handle is invalid or no data was provided.
   */
  public getWindowData(handle: WindowHandle): AttachedDataT | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;
    return windowState.data || null;
  }

  /**
   * Returns the current position and dimensions of the window.
   *
   * @param handle - The window handle.
   * @returns A {@link WindowRect}, or `null` if the handle is invalid.
   */
  public getWindowRect(handle: WindowHandle): WindowRect | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;

    const el = windowState.element;
    return {
      x: parsePx(el.style.left),
      y: parsePx(el.style.top),
      width: parsePx(el.style.width),
      height: parsePx(el.style.height),
    };
  }

  /**
   * Returns the minimum size constraints for the window.
   *
   * @param handle - The window handle.
   * @returns An object with `minWidth` and `minHeight`, or `null` if the handle is invalid.
   */
  public getMinSize(handle: WindowHandle): { minWidth: number; minHeight: number } | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;
    return {minWidth: windowState.minWidth, minHeight: windowState.minHeight};
  }

  /**
   * Returns the container element containing windows that represents the desktop.
   */
  public getDesktopElement(): HTMLElement {
    return this.desktopElement;
  }

  /**
   * Move the window to the specified position.
   * The position is clamped so that at least a small portion of the window remains visible
   * within the desktop bounds.
   *
   * @param handle - The window handle.
   * @param x - New horizontal position in pixels.
   * @param y - New vertical position in pixels.
   */
  public moveWindow(handle: WindowHandle, x: number, y: number): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;

    const el = windowState.element;
    const width = parsePx(el.style.width);
    const clampedPosition = this.clampWindowPositionWithinDesktop(x, y, width);

    el.style.left = `${clampedPosition.x}px`;
    el.style.top = `${clampedPosition.y}px`;
  }

  /**
   * Resizes and repositions the window.
   * The size is clamped to the minimum constraints (`minWidth`/`minHeight`) and the position
   * is clamped to keep the window within desktop bounds.
   *
   * @param handle - The window handle.
   * @param x - New horizontal position in pixels.
   * @param y - New vertical position in pixels.
   * @param width - New width in pixels (will be clamped to `minWidth`).
   * @param height - New height in pixels (will be clamped to `minHeight`).
   */
  public resizeWindow(handle: WindowHandle, x: number, y: number, width: number, height: number): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;

    const clampedWidth = Math.max(windowState.minWidth, width);
    const clampedHeight = Math.max(windowState.minHeight, height);
    const clampedPosition = this.clampWindowPositionWithinDesktop(x, y, clampedWidth);

    const el = windowState.element;
    el.style.left = `${clampedPosition.x}px`;
    el.style.top = `${clampedPosition.y}px`;
    el.style.width = `${clampedWidth}px`;
    el.style.height = `${clampedHeight}px`;
  }

  /** Clamp position so that at least `margin` pixels of the window remain visible within the container. */
  private clampWindowPositionWithinDesktop(x: number, y: number, windowWidth: number): { x: number; y: number } {
    const containerRect = this.desktopElement.getBoundingClientRect();
    const margin = this.resizeRegionSize * 2;
    return {
      x: Math.max(margin - windowWidth, Math.min(x, containerRect.width - margin)),
      y: Math.max(0, Math.min(y, containerRect.height - margin)),
    };
  }

  private resolveInitialPosition(x: number | undefined, y: number | undefined): { x: number; y: number } {
    // If explicit coordinates are provided ignore position strategy.
    if (x !== undefined && y !== undefined) {
      return {x, y};
    }

    if (this.positionStrategy.type === "required") {
      throw new Error("Position strategy requires explicit coordinates but none were provided.");
    }

    const getPositionOfCurrentlyFocusedWindow = () => {
      const handle = this.getFocusedWindow();
      if (!handle) return {x: 0, y: 0};
      const rect = this.getWindowRect(handle);
      if (!rect) return {x: 0, y: 0};

      return {x: rect.x, y: rect.y};
    }

    const {offsetX, offsetY} = this.positionStrategy;
    const {x: baseX, y: baseY} = getPositionOfCurrentlyFocusedWindow();

    return {x: baseX + offsetX, y: baseY + offsetY};
  }

  private applyZIndices(): void {
    const total = this.windows.size;
    for (const state of this.windows.values()) {
      state.element.style.zIndex = String(total - 1 - state.orderIdx);
    }
  }

  public override addEventListener<K extends keyof WindowManagerEventMap>(
    type: K,
    listener: (event: WindowManagerEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  public override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  public override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((event: CustomEvent) => void),
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }

  public override removeEventListener<K extends keyof WindowManagerEventMap>(
    type: K,
    listener: (event: WindowManagerEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  public override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  public override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((event: CustomEvent) => void),
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(type, listener as EventListener, options);
  }
}

function parsePx(value: string): number {
  return parseInt(value, 10) || 0;
}

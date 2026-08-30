import {
  type CreateWindowOptions,
  type DesktopMode,
  RESIZE_DIRECTIONS,
  type WindowHandle,
  type WindowPositionStrategy,
  type WindowRect
} from "./types.ts";
import type {
  ViewportTranslatedEventDetail,
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
type NoAttachedData = ReturnType<() => void>;

// Size of the native-scroll world layer in `"infinite-canvas"` mode.
// The camera starts centered, so logical world coordinates span approximately
// `-WORLD_ORIGIN_OFFSET` to `WORLD_ORIGIN_OFFSET` px on each axis.
const WORLD_SIZE_PX = 200_000;
const WORLD_ORIGIN_OFFSET = WORLD_SIZE_PX / 2;

const DEFAULT_ZOOM_LEVEL = 1;
const MIN_ZOOM_LEVEL = 0.1;

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

  /**
   * Determines how the desktop behaves (see {@link DesktopMode}).
   *
   * @defaultValue `{ type: "static" }`
   */
  mode?: DesktopMode;
}

/**
 * Core window management class that handles window lifecycle and actions such as drag, resize, focus, and ordering.
 *
 * Dispatches typed events (see {@link WindowManagerEventMap}):
 *
 * @typeParam AttachedDataT - Optional data type attached to each window. Use `void` (default) if no
 *   data is needed.
 */
export class WindowManager<AttachedDataT = NoAttachedData> extends EventTarget {
  private readonly desktopElement: HTMLElement;
  private readonly scrollerElement: HTMLDivElement;
  private readonly worldElement: HTMLDivElement;
  private readonly windows: Map<WindowHandle, WindowState<AttachedDataT>> = new Map();
  private readonly dragState: DragState;
  private readonly resizeState: ResizeState;
  private readonly resizeRegionSize: number;
  private readonly positionStrategy: WindowPositionStrategy;
  private readonly mode: DesktopMode;
  private translateX = 0;
  private translateY = 0;
  private zoomLevel = DEFAULT_ZOOM_LEVEL;

  /**
   * Creates a new WindowManager bound to the given container element.
   * The container acts as the "desktop" area where windows are positioned. A `biurko-desktop` CSS class
   * is added to it automatically.
   *
   * Windows are placed inside an inner `biurko-world` layer. In `"infinite-canvas"` mode this layer
   * can be translated to pan across the canvas (see {@link getViewportTranslate}).
   *
   * @param container - The DOM element that serves as the desktop area.
   * @param options - Optional configuration details.
   */
  constructor(container: HTMLElement, options?: WindowManagerOptions) {
    super();
    this.desktopElement = container;
    this.desktopElement.classList.add("biurko-desktop");
    this.desktopElement.dataset['biurkoType'] = 'desktop';
    this.mode = options?.mode ?? {type: "static"};
    this.resizeRegionSize = options?.resizeRegionSize ?? DEFAULT_RESIZE_REGION_SIZE;
    this.positionStrategy = options?.positionStrategy ?? {type: "required"};

    this.desktopElement.style.position = "relative";

    const scrollerElement = document.createElement("div");
    scrollerElement.dataset['biurkoType'] = 'scroller';
    scrollerElement.style.position = "absolute";
    scrollerElement.style.top = "0px";
    scrollerElement.style.left = "0px";
    scrollerElement.style.width = "100%";
    scrollerElement.style.height = "100%";
    scrollerElement.style.overflow = "hidden";

    if (this.mode.type === "infinite-canvas") {
      scrollerElement.style.overscrollBehavior = "none";
      scrollerElement.addEventListener("wheel", (e: WheelEvent): void => this.onWheel(e), {passive: false});
    }

    const worldElement = document.createElement("div");
    worldElement.dataset['biurkoType'] = "world";
    worldElement.style.position = "absolute";
    worldElement.style.top = "0px";
    worldElement.style.left = "0px";

    if (this.mode.type === "infinite-canvas") {
      worldElement.style.width = `${WORLD_SIZE_PX}px`;
      worldElement.style.height = `${WORLD_SIZE_PX}px`;
      worldElement.style.transformOrigin = "center center";
    } else {
      worldElement.style.width = "100%";
      worldElement.style.height = "100%";
    }

    scrollerElement.appendChild(worldElement);
    this.desktopElement.appendChild(scrollerElement);
    this.scrollerElement = scrollerElement;
    this.worldElement = worldElement;

    if (this.mode.type === "infinite-canvas") {
      this.scrollerElement.scrollLeft = WORLD_ORIGIN_OFFSET;
      this.scrollerElement.scrollTop = WORLD_ORIGIN_OFFSET;
    }

    this.dragState = createDragState(this);
    this.resizeState = createResizeState(this);
  }

  /**
   * Creates a new window and appends it to the desktop's world layer.
   * The window is automatically focused (brought to front) upon creation.
   * Dispatches a `"window-opened"` event.
   *
   * @param options - Configuration details (see {@link CreateWindowOptions}).
   * @param args - If `AttachedDataT` is not `void`, the attached data must be passed as the second argument.
   * @returns A unique {@link WindowHandle} identifying the created window.
   */
  public createWindow(options: CreateWindowOptions, ...args: AttachedDataT extends NoAttachedData ? [] : [data: AttachedDataT]): WindowHandle {
    const handle = crypto.randomUUID() as WindowHandle;
    const data = args[0] as AttachedDataT | undefined;
    const position = this.resolveInitialPosition(options.x, options.y);

    const element = document.createElement("div");
    element.dataset["windowHandle"] = handle;
    element.dataset["biurkoType"] = 'window';
    element.style.position = "absolute";
    const originOffset = this.worldOriginOffset;
    element.style.left = `${position.x + originOffset}px`;
    element.style.top = `${position.y + originOffset}px`;
    element.style.width = `${options.width}px`;
    element.style.height = `${options.height}px`;

    const surface = document.createElement("div");
    surface.classList.add("biurko-surface");
    surface.style.height = "100%";
    surface.style.overflow = "hidden";

    if (this.mode.type === "infinite-canvas") {
      // Prevent wheel scrolling over an unscrollable window from chaining into the canvas.
      surface.style.overscrollBehavior = "contain";
    }

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

    this.worldElement.appendChild(element);

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
    const originOffset = this.worldOriginOffset;
    return {
      x: parsePx(el.style.left) - originOffset,
      y: parsePx(el.style.top) - originOffset,
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

  /** Offset between logical world coordinates and physical offsets inside the world layer. */
  private get worldOriginOffset(): number {
    return this.mode.type === "infinite-canvas" ? WORLD_ORIGIN_OFFSET : 0;
  }

  /**
   * Returns the current translate offset of the world layer.
   * The offset is `0,0` unless the mode is `"infinite-canvas"`.
   *
   * @returns The horizontal and vertical translate offsets in pixels.
   */
  public getViewportTranslate(): { x: number; y: number } {
    return {x: this.translateX, y: this.translateY};
  }

  /**
   * Sets the translation offset of the world layer.
   * In `"infinite-canvas"` mode the offset is center-origin and bounded to approximately
   * `±100000` px per axis (the size of the scrollable world).
   * Dispatches a `"viewport-translated"` event when the offset changes.
   *
   * @param x - New horizontal offset in pixels.
   * @param y - New vertical offset in pixels.
   */
  public setViewportTranslate(x: number, y: number): void {
    if (x === this.translateX && y === this.translateY) return;

    this.translateX = x;
    this.translateY = y;

    this.scrollerElement.scrollLeft = WORLD_ORIGIN_OFFSET - this.translateX;
    this.scrollerElement.scrollTop = WORLD_ORIGIN_OFFSET - this.translateY;

    this.dispatchEvent(new CustomEvent<ViewportTranslatedEventDetail>("viewport-translated", {
      detail: {x, y},
    }));
  }

  /**
   * Translates the world layer by a relative offset (see {@link setViewportTranslate}).
   *
   * @param dx - Horizontal offset delta in pixels.
   * @param dy - Vertical offset delta in pixels.
   */
  public translateViewport(dx: number, dy: number): void {
    this.setViewportTranslate(this.translateX + dx, this.translateY + dy);
  }

  /**
   * Sets the scale of the world layer.
   *
   * @param level - The scale applied to the world layer.
   */
  public setZoomLevel(level: number): void {
    this.zoomLevel = Math.max(MIN_ZOOM_LEVEL, level);
    // translateZ(0) is necessary to prevent rendering weird shadow-lines when translating viewport on smaller zoom.
    this.worldElement.style.transform = `scale(${this.zoomLevel}) translateZ(0)`;
  }

  /**
   * Scale the world layer by `delta` amount.
   *
   * @param delta - The delta applied to the world layer scale.
   */
  public zoomBy(delta: number): void {
    this.setZoomLevel(this.zoomLevel + delta);
  }


  /** Resets the infinite-canvas zoom level to its default value. */
  public resetZoomLevel(): void {
    this.setZoomLevel(DEFAULT_ZOOM_LEVEL);
  }

  /**
   * Returns the scale of the world layer.
   * @returns current scale of world layer.
   */
  public getZoomLevel(): number {
    return this.zoomLevel;
  }

  private setZoomLevelAtPoint(level: number, clientX: number, clientY: number): void {
    const point = this.clientToWorld(clientX, clientY);
    const previousZoomLevel = this.zoomLevel;

    this.setZoomLevel(level);

    const zoomDelta = this.zoomLevel - previousZoomLevel;
    this.setViewportTranslate(
      this.translateX - zoomDelta * point.x,
      this.translateY - zoomDelta * point.y,
    );
  }

  /**
   * Converts viewport (client) coordinates to desktop world coordinates,
   * taking the current viewport translate into account.
   *
   * @param clientX - Horizontal position in client (viewport) coordinates.
   * @param clientY - Vertical position in client (viewport) coordinates.
   * @returns The corresponding position in desktop coordinate space.
   */
  public clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.scrollerElement.getBoundingClientRect();
    const originOffset = this.worldOriginOffset;
    return {
      x: (clientX - rect.left + this.scrollerElement.scrollLeft - originOffset) / this.zoomLevel,
      y: (clientY - rect.top + this.scrollerElement.scrollTop - originOffset) / this.zoomLevel,
    };
  }

  private onWheel(e: WheelEvent): void {
    if (this.dragState.isActive() || this.resizeState.isActive()) return;

    const zoomMode = e.shiftKey;
    const ignoreOriginElement = e.altKey;

    if (!ignoreOriginElement) {
      const type = (e.target as HTMLHtmlElement).dataset['biurkoType'];
      if (type !== this.scrollerElement.dataset['biurkoType'] && type !== this.worldElement.dataset['biurkoType']) {
        return;
      }
    }

    if (zoomMode) {
      const factor = Math.exp(e.deltaY / 1000);
      this.setZoomLevelAtPoint(this.zoomLevel * factor, e.clientX, e.clientY);
    } else {
      this.translateViewport(-e.deltaX, -e.deltaY);
    }
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
    const originOffset = this.worldOriginOffset;
    const clampedPosition = this.clampWindowPositionWithinDesktop(x, y, width);

    el.style.left = `${clampedPosition.x + originOffset}px`;
    el.style.top = `${clampedPosition.y + originOffset}px`;
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
    const originOffset = this.worldOriginOffset;
    el.style.left = `${clampedPosition.x + originOffset}px`;
    el.style.top = `${clampedPosition.y + originOffset}px`;
    el.style.width = `${clampedWidth}px`;
    el.style.height = `${clampedHeight}px`;
  }

  /** Clamp position so that at least `margin` pixels of the window remain visible within the container. */
  private clampWindowPositionWithinDesktop(x: number, y: number, windowWidth: number): { x: number; y: number } {
    if (this.mode.type === "infinite-canvas") {
      return {x, y};
    }

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

    const getPositionOfCurrentlyFocusedWindow = (): { x: number; y: number } => {
      const handle = this.getFocusedWindow();
      if (!handle) return {x: 0, y: 0};
      const rect = this.getWindowRect(handle);
      if (!rect) return {x: 0, y: 0};

      return {x: rect.x, y: rect.y};
    };

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

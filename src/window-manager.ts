import {RESIZE_DIRECTIONS, type WindowHandle, type WindowOptions, type WindowRect} from "./types.ts";
import type {
  WindowCloseEventDetail,
  WindowFocusEventDetail,
  WindowManagerEventMap,
  WindowOpenedEventDetail,
} from "./events.ts";
import {createDragState, type DragState} from "./drag-state.ts";
import {createResizeState, type ResizeState} from "./resize-state.ts";
import {applyResizeRegionStyles} from "./resize-region-styling.ts";

interface WindowState<TData> {
  handle: WindowHandle;
  element: HTMLDivElement;
  surface: HTMLDivElement;
  title: string;
  data: TData | undefined;
  dragRegionSelector: string;
  minWidth: number;
  minHeight: number;
  orderIdx: number;
}

const DEFAULT_RESIZE_REGION_SIZE = 6;

export interface WindowManagerOptions {
  resizeRegionSize?: number;
}

export class WindowManager<TData = void> extends EventTarget {
  private readonly desktopElement: HTMLElement;
  private readonly windows: Map<WindowHandle, WindowState<TData>> = new Map();
  private readonly dragState: DragState;
  private readonly resizeState: ResizeState;
  private readonly resizeRegionSize: number;

  constructor(container: HTMLElement, options?: WindowManagerOptions) {
    super();
    this.desktopElement = container;
    this.desktopElement.classList.add("biurko-desktop");
    this.resizeRegionSize = options?.resizeRegionSize ?? DEFAULT_RESIZE_REGION_SIZE;
    this.dragState = createDragState(this);
    this.resizeState = createResizeState(this);
  }

  public createWindow(options: WindowOptions, ...args: TData extends void ? [] : [data: TData]): WindowHandle {
    const handle = crypto.randomUUID() as WindowHandle;
    const data = args[0] as TData | undefined;

    const element = document.createElement("div");
    element.dataset["windowHandle"] = handle;
    element.style.position = "absolute";
    element.style.left = `${options.x}px`;
    element.style.top = `${options.y}px`;
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

    const state: WindowState<TData> = {
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

    this.dispatchEvent(new CustomEvent<WindowFocusEventDetail>("window-focused", {
      detail: {handle},
    }));
  }

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

    this.dispatchEvent(new CustomEvent<WindowCloseEventDetail>("window-closed", {
      detail: {handle},
    }));
  }

  public getWindowSurface(handle: WindowHandle): HTMLDivElement | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;
    return windowState.surface;
  }

  public getWindowTitle(handle: WindowHandle): string | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;
    return windowState.title;
  }

  public setWindowTitle(handle: WindowHandle, title: string): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;
    windowState.title = title;
  }

  public getWindowData(handle: WindowHandle): TData | undefined {
    const windowState = this.windows.get(handle);
    if (!windowState) return undefined;
    return windowState.data;
  }

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

  public getMinSize(handle: WindowHandle): { minWidth: number; minHeight: number } | null {
    const windowState = this.windows.get(handle);
    if (!windowState) return null;
    return {minWidth: windowState.minWidth, minHeight: windowState.minHeight};
  }

  public getDesktopElement(): HTMLElement {
    return this.desktopElement;
  }

  public moveWindow(handle: WindowHandle, x: number, y: number): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;

    const el = windowState.element;
    const width = parsePx(el.style.width);
    const clampedPosition = this.clampWindowPositionWithinDesktop(x, y, width);

    el.style.left = `${clampedPosition.x}px`;
    el.style.top = `${clampedPosition.y}px`;
  }

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

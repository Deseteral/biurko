import type {WindowHandle, WindowOptions, WindowRect} from "./types.ts";
import type {
  WindowCloseEventDetail,
  WindowFocusEventDetail,
  WindowManagerEventMap,
  WindowMoveEventDetail,
  WindowOpenedEventDetail,
  WindowResizeEventDetail
} from "./events.ts";

interface WindowState {
  handle: WindowHandle;
  element: HTMLDivElement;
  titleBar: HTMLDivElement;
  surface: HTMLDivElement;
  minWidth: number;
  minHeight: number;
  orderIdx: number;
}

const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type ResizeDirection = typeof RESIZE_DIRECTIONS[number];

const DEFAULT_RESIZE_REGION_SIZE = 6;

export interface WindowManagerOptions {
  resizeRegionSize?: number;
}

export class WindowManager extends EventTarget {
  private readonly desktopElement: HTMLElement;
  private readonly windows: Map<WindowHandle, WindowState> = new Map();
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

  public createWindow(options: WindowOptions): WindowHandle {
    const handle = crypto.randomUUID() as WindowHandle;

    const element = document.createElement("div");
    element.classList.add("biurko-window");
    element.dataset["windowHandle"] = handle;
    element.style.position = "absolute";
    element.style.left = `${options.x}px`;
    element.style.top = `${options.y}px`;
    element.style.width = `${options.width}px`;
    element.style.height = `${options.height}px`;

    const content = document.createElement("div");
    content.classList.add("biurko-window-content");
    content.style.position = "relative";
    content.style.width = "100%";
    content.style.height = "100%";
    content.style.overflow = "hidden";

    const titleBar = document.createElement("div");
    titleBar.classList.add("biurko-title-bar");

    const titleSpan = document.createElement("span");
    titleSpan.classList.add("biurko-title");
    titleSpan.textContent = options.title;
    titleBar.appendChild(titleSpan);

    content.appendChild(titleBar);

    const surface = document.createElement("div");
    surface.classList.add("biurko-surface");
    content.appendChild(surface);

    element.appendChild(content);

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

    const state: WindowState = {
      handle,
      element,
      titleBar,
      surface,
      minWidth: options.minWidth ?? 0,
      minHeight: options.minHeight ?? 0,
      orderIdx: 0,
    };

    this.windows.set(handle, state);

    element.addEventListener("mousedown", (): void => {
      this.focusWindow(handle);
    });

    titleBar.addEventListener("mousedown", (e: MouseEvent): void => {
      this.dragState.start(handle, e.clientX, e.clientY);
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

  public moveWindow(handle: WindowHandle, x: number, y: number): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;

    const el = windowState.element;
    const width = parsePx(el.style.width);
    const height = parsePx(el.style.height);

    // Clamp to container bounds.
    const containerRect = this.desktopElement.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(x, containerRect.width - width));
    const clampedY = Math.max(0, Math.min(y, containerRect.height - height));

    el.style.left = `${clampedX}px`;
    el.style.top = `${clampedY}px`;
  }

  public resizeWindow(handle: WindowHandle, x: number, y: number, width: number, height: number): void {
    const windowState = this.windows.get(handle);
    if (!windowState) return;

    const clampedWidth = Math.max(windowState.minWidth, width);
    const clampedHeight = Math.max(windowState.minHeight, height);

    const el = windowState.element;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${clampedWidth}px`;
    el.style.height = `${clampedHeight}px`;
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

// Since only one window can be actively dragged at a time, drag state is a singleton per manager.
interface DragState {
  start(handle: WindowHandle, clientX: number, clientY: number): void;
}

function createDragState(wm: WindowManager): DragState {
  let activeHandle: WindowHandle | null = null;
  let offsetX = 0;
  let offsetY = 0;

  function onMouseMove(e: MouseEvent): void {
    if (!activeHandle) return;

    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    wm.moveWindow(activeHandle, newX, newY);
  }

  function onMouseUp(): void {
    if (activeHandle) {
      const rect = wm.getWindowRect(activeHandle);
      if (rect) {
        wm.dispatchEvent(new CustomEvent<WindowMoveEventDetail>("window-moved", {
          detail: {handle: activeHandle, x: rect.x, y: rect.y},
        }));
      }
    }

    activeHandle = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  return {
    start(handle: WindowHandle, clientX: number, clientY: number): void {
      const rect = wm.getWindowRect(handle);
      if (!rect) return;

      activeHandle = handle;
      offsetX = clientX - rect.x;
      offsetY = clientY - rect.y;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
  };
}


interface ResizeState {
  start(handle: WindowHandle, direction: ResizeDirection, clientX: number, clientY: number): void;
}

function createResizeState(wm: WindowManager): ResizeState {
  let activeHandle: WindowHandle | null = null;
  let activeDirection: ResizeDirection | null = null;
  let startX = 0;
  let startY = 0;
  let startRect: WindowRect = {x: 0, y: 0, width: 0, height: 0};
  let minWidth = 0;
  let minHeight = 0;

  function start(handle: WindowHandle, direction: ResizeDirection, clientX: number, clientY: number): void {
    const rect = wm.getWindowRect(handle);
    if (!rect) return;

    const minSize = wm.getMinSize(handle);
    if (!minSize) return;

    activeHandle = handle;
    activeDirection = direction;
    startX = clientX;
    startY = clientY;
    startRect = {...rect};
    minWidth = minSize.minWidth;
    minHeight = minSize.minHeight;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent): void {
    if (!activeHandle || !activeDirection) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newX = startRect.x;
    let newY = startRect.y;
    let newWidth = startRect.width;
    let newHeight = startRect.height;

    // Horizontal component.
    if (activeDirection.includes("e")) { // Grow in x-axis.
      newWidth = Math.max(minWidth, startRect.width + dx);
    } else if (activeDirection.includes("w")) { // Shrink in x-axis.
      const proposedWidth = startRect.width - dx;
      if (proposedWidth >= minWidth) {
        newWidth = proposedWidth;
        newX = startRect.x + dx;
      } else {
        newWidth = minWidth;
        newX = startRect.x + (startRect.width - minWidth);
      }
    }

    // Vertical component.
    if (activeDirection.includes("s")) { // Grow in y-axis.
      newHeight = Math.max(minHeight, startRect.height + dy);
    } else if (activeDirection.includes("n")) { // Shrink in y-axis.
      const proposedHeight = startRect.height - dy;
      if (proposedHeight >= minHeight) {
        newHeight = proposedHeight;
        newY = startRect.y + dy;
      } else {
        newHeight = minHeight;
        newY = startRect.y + (startRect.height - minHeight);
      }
    }

    wm.resizeWindow(activeHandle, newX, newY, newWidth, newHeight);
  }

  function onMouseUp(): void {
    if (activeHandle) {
      const rect = wm.getWindowRect(activeHandle);
      if (rect) {
        wm.dispatchEvent(new CustomEvent<WindowResizeEventDetail>("window-resized", {
          detail: {handle: activeHandle, x: rect.x, y: rect.y, width: rect.width, height: rect.height},
        }));
      }
    }

    activeHandle = null;
    activeDirection = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  return {
    start,
  };
}

function applyResizeRegionStyles(el: HTMLDivElement, direction: ResizeDirection, regionSize: number): void {
  el.style.position = "absolute";
  el.style.zIndex = "1";
  el.style.cursor = `${direction}-resize`;

  // Handles are regionSize inside + regionSize outside the window edge (2 * regionSize total).
  const size = regionSize * 2;
  const offset = `-${regionSize}px`;
  const cornerSize = `${size}px`;
  const origin = `${regionSize}px`;

  switch (direction) {
    case "n":
      el.style.top = offset;
      el.style.left = origin;
      el.style.right = origin;
      el.style.height = `${size}px`;
      break;
    case "s":
      el.style.bottom = offset;
      el.style.left = origin;
      el.style.right = origin;
      el.style.height = `${size}px`;
      break;
    case "e":
      el.style.right = offset;
      el.style.top = origin;
      el.style.bottom = origin;
      el.style.width = `${size}px`;
      break;
    case "w":
      el.style.left = offset;
      el.style.top = origin;
      el.style.bottom = origin;
      el.style.width = `${size}px`;
      break;
    case "ne":
      el.style.top = offset;
      el.style.right = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
    case "nw":
      el.style.top = offset;
      el.style.left = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
    case "se":
      el.style.bottom = offset;
      el.style.right = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
    case "sw":
      el.style.bottom = offset;
      el.style.left = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
  }
}

function parsePx(value: string): number {
  return parseInt(value, 10) || 0;
}

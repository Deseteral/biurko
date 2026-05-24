import type {WindowHandle, WindowOptions, WindowRect} from "./types.ts";
import type {WindowManagerEventMap} from "./events.ts";

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

export class WindowManager extends EventTarget {
  private readonly desktopElement: HTMLElement;
  private readonly windows: Map<WindowHandle, WindowState> = new Map();
  private readonly dragState: DragState;

  constructor(container: HTMLElement) {
    super();
    this.desktopElement = container;
    this.desktopElement.classList.add("biurko-desktop");
    this.dragState = createDragState(this);
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

    const titleBar = document.createElement("div");
    titleBar.classList.add("biurko-title-bar");

    const titleSpan = document.createElement("span");
    titleSpan.classList.add("biurko-title");
    titleSpan.textContent = options.title;
    titleBar.appendChild(titleSpan);

    element.appendChild(titleBar);

    for (const direction of RESIZE_DIRECTIONS) {
      const resizeHandle = document.createElement("div");
      resizeHandle.dataset["resizeDirection"] = direction;
      element.appendChild(resizeHandle);
    }

    const surface = document.createElement("div");
    surface.classList.add("biurko-surface");
    element.appendChild(surface);

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

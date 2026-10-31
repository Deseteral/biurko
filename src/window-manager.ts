import {
  type CreateWindowOptions,
  type DesktopMode,
  RESIZE_DIRECTIONS,
  type WindowHandle,
  type WindowInteractivity,
  type WindowParentOptions,
  type WindowPositionStrategy,
  type WindowRect,
} from "./types.ts";
import type {
  ViewportTranslatedEventDetail,
  WindowClosedEventDetail,
  WindowFocusedEventDetail,
  WindowManagerEventMap,
  WindowOpenedEventDetail,
  WindowParentChangedEventDetail,
} from "./events.ts";
import { createDragState, type DragState } from "./drag-state.ts";
import { createResizeState, type ResizeState } from "./resize-state.ts";
import { applyResizeRegionStyles } from "./resize-region-styling.ts";

/**
 * Parent-child relationship of a window: the parent's handle and its relationship options.
 */
interface WindowParent {
  /** Handle of the parent window. */
  handle: WindowHandle;

  /** Whether dragging tears the window off this parent. */
  detachOnDrag: boolean;
}

interface WindowState<AttachedDataT> {
  handle: WindowHandle;
  element: HTMLDivElement;
  surface: HTMLDivElement;
  title: string;
  data: AttachedDataT | undefined;
  minWidth: number;
  minHeight: number;
  orderIdx: number;
  parentWindow: WindowParent | null;
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

const DRAG_REGION_SELECTOR = "[data-biurko-drag-region]";

/** Configuration options for the {@link WindowManager} constructor. */
export interface WindowManagerOptions {
  /**
   * Distance (in pixels) that invisible resize hit regions extend inside and outside each window edge.
   * Edge hit regions are twice this value in thickness; corner regions are squares of that size.
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

  /**
   * Determines which windows can receive mouse input events.
   *
   * @defaultValue `{ type: "all" }`
   */
  windowInteractivity?: WindowInteractivity;
}

/**
 * Core window management class that handles window lifecycle and actions such as drag, resize, focus, and ordering.
 *
 * Dispatches typed events (see {@link WindowManagerEventMap}).
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
  private readonly windowInteractivity: WindowInteractivity;
  private translateX = 0;
  private translateY = 0;
  private zoomLevel = DEFAULT_ZOOM_LEVEL;

  /**
   * Creates a new WindowManager bound to the given container element.
   * The container acts as the "desktop" area where windows are positioned. Its `data-biurko-type`
   * attribute is set to `"desktop"`, its position is set to `relative`, and the `biurko-desktop`
   * CSS class is added automatically.
   *
   * Windows are placed inside an inner layer with `data-biurko-type="world"`.
   * In `"infinite-canvas"` mode, scrolling the desktop background pans the canvas and
   * Shift+wheel zooms around the pointer. Holding Alt also enables these gestures over windows.
   * Panning is also available through {@link setViewportTranslate}.
   *
   * @param container - The DOM element that serves as the desktop area.
   * @param options - Optional configuration details.
   */
  constructor(container: HTMLElement, options?: WindowManagerOptions) {
    super();
    this.desktopElement = container;
    this.desktopElement.classList.add("biurko-desktop");
    this.desktopElement.dataset["biurkoType"] = "desktop";
    this.mode = options?.mode ?? { type: "static" };
    this.windowInteractivity = options?.windowInteractivity ?? { type: "all" };
    this.resizeRegionSize = options?.resizeRegionSize ?? DEFAULT_RESIZE_REGION_SIZE;
    this.positionStrategy = options?.positionStrategy ?? { type: "required" };

    this.desktopElement.style.position = "relative";

    const scrollerElement = document.createElement("div");
    scrollerElement.dataset["biurkoType"] = "scroller";
    scrollerElement.style.position = "absolute";
    scrollerElement.style.top = "0px";
    scrollerElement.style.left = "0px";
    scrollerElement.style.width = "100%";
    scrollerElement.style.height = "100%";
    scrollerElement.style.overflow = "hidden";

    if (this.mode.type === "infinite-canvas") {
      scrollerElement.style.overscrollBehavior = "none";
      scrollerElement.addEventListener("wheel", (e: WheelEvent): void => this.onWheel(e), { passive: false });
    }

    const worldElement = document.createElement("div");
    worldElement.dataset["biurkoType"] = "world";
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

    // Force drag region to be always interactive, even if window is not (because it's not focused).
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`${DRAG_REGION_SELECTOR} { pointer-events: all; }`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }

  /**
   * Creates a new window and appends it to the desktop's world layer.
   * The window is automatically focused (brought to front) upon creation.
   * Dispatches `"window-focused"` before `"window-opened"`.
   * Initial position and size are not clamped to desktop bounds or minimum size constraints.
   *
   * @param options - Configuration details (see {@link CreateWindowOptions}).
   * @param args - If `AttachedDataT` is not `void`, the attached data must be passed as the second argument.
   * @returns A unique {@link WindowHandle} identifying the created window.
   * @throws Error if either coordinate is missing when the position strategy is `"required"`.
   */
  public createWindow(
    options: CreateWindowOptions,
    ...args: AttachedDataT extends NoAttachedData ? [] : [data: AttachedDataT]
  ): WindowHandle {
    const handle = crypto.randomUUID() as WindowHandle;
    const data = args[0] as AttachedDataT | undefined;
    const position = this.resolveInitialPosition(options.x, options.y);

    // Create root window element.
    const element = document.createElement("div");
    element.dataset["windowHandle"] = handle;
    element.dataset["biurkoType"] = "window";
    element.style.position = "absolute";
    const originOffset = this.worldOriginOffset;
    element.style.left = `${position.x + originOffset}px`;
    element.style.top = `${position.y + originOffset}px`;
    element.style.width = `${options.width}px`;
    element.style.height = `${options.height}px`;

    // Create container for user content (including window chrome).
    const surface = document.createElement("div");
    surface.classList.add("biurko-surface");
    surface.style.height = "100%";
    surface.style.overflow = "hidden";

    if (this.windowInteractivity.type === "focused-only") {
      surface.style.pointerEvents = "none";
    }

    if (this.mode.type === "infinite-canvas") {
      // Prevent wheel scrolling over an unscrollable window from chaining into the canvas.
      surface.style.overscrollBehavior = "contain";
    }

    element.appendChild(surface);

    // Create resize regions.
    if (options.resizable ?? true) {
      for (const direction of RESIZE_DIRECTIONS) {
        const resizeRegion = document.createElement("div");
        resizeRegion.dataset["resizeDirection"] = direction;
        applyResizeRegionStyles(resizeRegion, direction, this.resizeRegionSize);

        resizeRegion.addEventListener("mousedown", (e: MouseEvent): void => {
          e.stopPropagation();
          this.resizeState.start(handle, direction, e.clientX, e.clientY);
          this.focusWindow(handle);
        });

        element.appendChild(resizeRegion);
      }
    }

    // Add window to the DOM.
    this.worldElement.appendChild(element);

    // Add new window to window registry.
    const state: WindowState<AttachedDataT> = {
      handle,
      element,
      surface,
      title: options.title,
      data,
      minWidth: options.minWidth ?? 0,
      minHeight: options.minHeight ?? 0,
      orderIdx: this.windows.size, // Put window behind other windows, and let focusing logic handle ordering.
      parentWindow: null,
    };
    this.windows.set(handle, state);

    // Handle clicking on window.
    element.addEventListener("mousedown", (e: MouseEvent): void => {
      // When drag region was the target, start window moving logic.
      const target = e.target as Element | null;
      if (target?.closest(DRAG_REGION_SELECTOR)) {
        this.dragState.start(handle, e.clientX, e.clientY);
      }

      // Make the window focused.
      this.focusWindow(handle);
    });

    // Make new window focused.
    this.focusWindow(handle);

    this.dispatchEvent(
      new CustomEvent<WindowOpenedEventDetail>("window-opened", {
        detail: { handle },
      }),
    );

    return handle;
  }

  /**
   * Brings the specified window to front.
   * No-op if the handle is invalid.
   * Dispatches a `"window-focused"` event even if the window is already focused.
   *
   * @param handle - The handle of the window to focus.
   */
  public focusWindow(handle: WindowHandle): void {
    const target = this.windows.get(handle);
    if (!target) return;

    for (const state of this.windows.values()) {
      if (state.handle === handle) continue;

      // Currently focused window needs to stop receiving pointer events.
      if (this.windowInteractivity.type === "focused-only" && state.orderIdx === 0) {
        state.surface.style.pointerEvents = "none";
      }

      // Shift back other windows.
      // Only windows that were in front of target need to shift back.
      if (state.orderIdx < target.orderIdx) {
        state.orderIdx += 1;
      }
    }

    // Newly focused windows needs to start receiving pointer events.
    target.surface.style.pointerEvents = "all";

    // Bring newly focused window to the front.
    target.orderIdx = 0;
    this.applyWindowOrdering();

    this.dispatchEvent(
      new CustomEvent<WindowFocusedEventDetail>("window-focused", {
        detail: { handle },
      }),
    );
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
   * Closes and removes the window together with its complete descendant subtree.
   * The windows' DOM elements are removed and their internal state is cleaned up.
   * One `"window-closed"` event is dispatched per removed window, descendants first.
   * No-op if the handle is invalid or its window is no longer open.
   *
   * @param handle - The handle of the window to close.
   */
  public closeWindow(handle: WindowHandle): void {
    const rootWindowState = this.windows.get(handle);
    if (!rootWindowState) return;

    // Reverse to dispatch events from deepest child first.
    const subtree = this.collectWindowSubtree(handle).reverse();

    for (const state of subtree) {
      state.element.remove();
      this.windows.delete(state.handle);
    }

    this.applyWindowOrdering();

    const nextFocusedWindow = this.getFocusedWindow();
    if (nextFocusedWindow) {
      this.focusWindow(nextFocusedWindow);
    }

    for (const state of subtree) {
      this.dispatchEvent(
        new CustomEvent<WindowClosedEventDetail>("window-closed", {
          detail: { handle: state.handle },
        }),
      );
    }
  }

  /**
   * Attaches a window to another window, forming a parent-child relationship.
   * Moving the parent moves the complete child subtree (see {@link moveWindow}),
   * and closing the parent closes the complete child subtree (see {@link closeWindow}).
   * Attachment does not affect position, size, focus, z-order, or DOM structure.
   *
   * Attaching a window to itself or to one of its descendants is rejected.
   * Attaching a window that already has a parent reparents it with the given options.
   * No-op if either handle is invalid or the relationship already exists.
   * Dispatches a `"window-parent-changed"` event on success.
   *
   * @param child - The handle of the window to attach.
   * @param parent - The handle of the window to attach to.
   * @param options - Configuration of the relationship (see {@link WindowParentOptions}).
   *   To change the options of an existing relationship, detach the window and attach it again.
   */
  public attachWindowToParent(child: WindowHandle, parent: WindowHandle, options?: WindowParentOptions): void {
    const childState = this.windows.get(child);
    if (!childState || !this.windows.has(parent)) return;
    if (child === parent) return;
    if (childState.parentWindow?.handle === parent) return;

    // Walk up from the proposed parent. Reaching the child would create a cycle.
    let ancestor: WindowHandle | null = parent;
    while (ancestor !== null) {
      if (ancestor === child) return;
      ancestor = this.windows.get(ancestor)?.parentWindow?.handle ?? null;
    }

    const previousParent = childState.parentWindow?.handle ?? null;
    childState.parentWindow = {
      handle: parent,
      detachOnDrag: options?.detachOnDrag ?? false,
    };

    this.dispatchEvent(
      new CustomEvent<WindowParentChangedEventDetail>("window-parent-changed", {
        detail: { handle: child, previousParent, parent },
      }),
    );
  }

  /**
   * Detaches a window from its parent, turning the window together with its
   * descendants into an independent root tree. Descendant relationships are preserved.
   * Relationship options are reset to defaults.
   * No-op if the handle is invalid or the window has no parent.
   * Dispatches a `"window-parent-changed"` event on success.
   *
   * @param child - The handle of the window to detach.
   */
  public detachWindowFromParent(child: WindowHandle): void {
    const childState = this.windows.get(child);
    if (!childState || childState.parentWindow === null) return;

    const previousParent = childState.parentWindow?.handle ?? null;
    childState.parentWindow = null;

    this.dispatchEvent(
      new CustomEvent<WindowParentChangedEventDetail>("window-parent-changed", {
        detail: { handle: child, previousParent, parent: null },
      }),
    );
  }

  /**
   * Returns the parent of the given window.
   *
   * @param child - The window handle.
   * @returns The parent handle, or `null` if the window is a root or the handle is invalid.
   */
  public getWindowParent(child: WindowHandle): WindowHandle | null {
    return this.windows.get(child)?.parentWindow?.handle ?? null;
  }

  /**
   * Returns the direct children of the given window.
   *
   * @param parent - The window handle.
   * @returns The handles of direct children in creation order. Empty if the window has no children.
   */
  public getChildren(parent: WindowHandle): WindowHandle[] {
    const children: WindowHandle[] = [];
    for (const state of this.windows.values()) {
      if (state.parentWindow?.handle === parent) {
        children.push(state.handle);
      }
    }
    return children;
  }

  /**
   * Returns the options of the parent-child relationship of the given window
   * (see {@link attachWindowToParent}).
   *
   * @param child - The window handle.
   * @returns The relationship options with defaults applied. Defaults are returned
   *   if the window is a root or the handle is invalid.
   */
  public getWindowParentOptions(child: WindowHandle): Required<WindowParentOptions> {
    const childState = this.windows.get(child);
    return { detachOnDrag: childState?.parentWindow?.detachOnDrag ?? false };
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
   * @returns The attached data, or `null` if the handle is invalid or the stored data is falsy
   *   (including when no data was provided).
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

    return this.getWindowRectInWorldCoords(windowState);
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
    return { minWidth: windowState.minWidth, minHeight: windowState.minHeight };
  }

  /**
   * Returns the container element containing windows that represents the desktop.
   */
  public getDesktopElement(): HTMLElement {
    return this.desktopElement;
  }

  /** Offset between logical world coordinates and physical offsets inside the world layer. */
  // TODO: This could be cached.
  private get worldOriginOffset(): number {
    return this.mode.type === "infinite-canvas" ? WORLD_ORIGIN_OFFSET : 0;
  }

  /**
   * Returns the stored viewport translation, initially `{ x: 0, y: 0 }`.
   * This is the requested offset, which may differ from the actual scroll position
   * when the browser clamps scrolling at the world bounds.
   *
   * @returns The horizontal and vertical translate offsets in pixels.
   */
  public getViewportTranslate(): { x: number; y: number } {
    return { x: this.translateX, y: this.translateY };
  }

  /**
   * Stores a viewport translation and updates the inner container's scroll position.
   * Intended for `"infinite-canvas"` mode, where positive offsets pan the world right and down.
   * The stored offsets are not clamped, but the browser limits the actual scroll position
   * to the scrollable world bounds. Static mode does not ignore or reset these offsets.
   * Dispatches a `"viewport-translated"` event when the stored offset changes.
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

    this.dispatchEvent(
      new CustomEvent<ViewportTranslatedEventDetail>("viewport-translated", {
        detail: { x, y },
      }),
    );
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
   * Values below `0.1` are clamped to `0.1`; there is no maximum.
   * Applies in both desktop modes and does not adjust the viewport translation.
   *
   * @param level - The scale applied to the world layer.
   */
  public setZoomLevel(level: number): void {
    this.zoomLevel = Math.max(MIN_ZOOM_LEVEL, level);
    // translateZ(0) is necessary to prevent rendering weird shadow-lines when translating viewport on smaller zoom.
    this.worldElement.style.transform = `scale(${this.zoomLevel}) translateZ(0)`;
  }

  /**
   * Adds `delta` to the current zoom level (see {@link setZoomLevel}).
   * This is an additive change, not a multiplication of the scale.
   *
   * @param delta - The delta applied to the world layer scale.
   */
  public zoomBy(delta: number): void {
    this.setZoomLevel(this.zoomLevel + delta);
  }

  /** Resets the world layer's zoom level to `1` without changing the viewport translation. */
  public resetZoomLevel(): void {
    this.setZoomLevel(DEFAULT_ZOOM_LEVEL);
  }

  /**
   * Returns the scale of the world layer.
   *
   * @returns The current zoom level, initially `1` and at least `0.1`.
   */
  public getZoomLevel(): number {
    return this.zoomLevel;
  }

  private setZoomLevelAtPoint(level: number, clientX: number, clientY: number): void {
    const point = this.clientToWorld(clientX, clientY);
    const previousZoomLevel = this.zoomLevel;

    this.setZoomLevel(level);

    const zoomDelta = this.zoomLevel - previousZoomLevel;
    this.setViewportTranslate(this.translateX - zoomDelta * point.x, this.translateY - zoomDelta * point.y);
  }

  /**
   * Converts viewport (client) coordinates to desktop world coordinates,
   * taking the desktop's position, actual scroll offsets, and zoom level into account.
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
      const type = (e.target as HTMLHtmlElement).dataset["biurkoType"];
      if (type !== this.scrollerElement.dataset["biurkoType"] && type !== this.worldElement.dataset["biurkoType"]) {
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
   * Moves the window to the specified position in desktop coordinate space.
   * The window's complete descendant subtree (see {@link attachWindowToParent}) is moved
   * by the same delta, preserving relative positions inside the subtree.
   * In `"static"` mode only the moved root is clamped to keep a small portion visible
   * within the desktop bounds; descendants follow rigidly and may overflow the bounds.
   * In `"infinite-canvas"` mode positions are not clamped.
   * No-op if the handle is invalid. Does not dispatch `"window-moved"`;
   * that event is dispatched only when a drag gesture completes, for the dragged window.
   *
   * @param handle - The window handle.
   * @param x - New horizontal position in pixels.
   * @param y - New vertical position in pixels.
   */
  public moveWindow(handle: WindowHandle, x: number, y: number): void {
    const rootState = this.windows.get(handle);
    if (!rootState) return;

    const rootRect = this.getWindowRectInWorldCoords(rootState);
    const target = this.clampWindowPositionWithinDesktop(x, y, rootRect.width);
    const dx = target.x - rootRect.x;
    const dy = target.y - rootRect.y;

    const originOffset = this.worldOriginOffset;
    for (const state of this.collectWindowSubtree(handle)) {
      const rect = this.getWindowRectInWorldCoords(state);
      state.element.style.left = `${rect.x + dx + originOffset}px`;
      state.element.style.top = `${rect.y + dy + originOffset}px`;
    }
  }

  /**
   * Resizes and repositions the window.
   * The size is clamped to the minimum constraints (`minWidth`/`minHeight`).
   * In `"static"` mode the position is clamped to keep a small portion of the window visible;
   * in `"infinite-canvas"` mode the position is not clamped.
   * Descendant windows are not moved or resized.
   * No-op if the handle is invalid. Does not dispatch `"window-resized"`;
   * that event is dispatched only when a resize gesture completes.
   *
   * @param handle - The window handle.
   * @param x - New horizontal position in pixels in desktop coordinate space.
   * @param y - New vertical position in pixels in desktop coordinate space.
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
      return { x, y };
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
      return { x, y };
    }

    if (this.positionStrategy.type === "required") {
      throw new Error("Position strategy requires explicit coordinates but none were provided.");
    }

    const getPositionOfCurrentlyFocusedWindow = (): { x: number; y: number } => {
      const handle = this.getFocusedWindow();
      if (!handle) return { x: 0, y: 0 };
      const rect = this.getWindowRect(handle);
      if (!rect) return { x: 0, y: 0 };

      return { x: rect.x, y: rect.y };
    };

    const { offsetX, offsetY } = this.positionStrategy;
    const { x: baseX, y: baseY } = getPositionOfCurrentlyFocusedWindow();

    return { x: baseX + offsetX, y: baseY + offsetY };
  }

  /**
   * Stabilize orderIdx (make them continuous, remove duplicate indices).
   * Apply order to z-index for all windows.
   * This method must be called everytime any orderIdx is changed.
   */
  private applyWindowOrdering(): void {
    const sortedWindows = [...this.windows.values()].sort((a, b) => a.orderIdx - b.orderIdx);

    for (const [idx, state] of sortedWindows.entries()) {
      state.orderIdx = idx;
      state.element.style.zIndex = String(sortedWindows.length - 1 - idx);
    }
  }

  private getWindowRectInWorldCoords(windowState: WindowState<AttachedDataT>): WindowRect {
    const el = windowState.element;
    const originOffset = this.worldOriginOffset;
    return {
      x: parsePx(el.style.left) - originOffset,
      y: parsePx(el.style.top) - originOffset,
      width: parsePx(el.style.width),
      height: parsePx(el.style.height),
    };
  }

  private buildChildrenIndex(): Map<WindowHandle, WindowState<AttachedDataT>[]> {
    const childrenByParent = new Map<WindowHandle, WindowState<AttachedDataT>[]>();

    for (const state of this.windows.values()) {
      const parent = state.parentWindow?.handle;
      if (!parent) continue;

      const children = childrenByParent.get(parent);
      if (children) {
        children.push(state);
      } else {
        childrenByParent.set(parent, [state]);
      }
    }

    return childrenByParent;
  }

  // TODO: This is totally suboptimal algorithm. If we change how the state of windows are stored in memory we will get
  //       simpler and faster processing. Current implementation is fine, because computers are fast, but this is not
  //       what striving for excellence should look like.
  private collectWindowSubtree(handle: WindowHandle): WindowState<AttachedDataT>[] {
    const root = this.windows.get(handle);
    if (!root) return [];

    const childrenByParent = this.buildChildrenIndex();
    const result: WindowState<AttachedDataT>[] = [];
    const stack: WindowState<AttachedDataT>[] = [root];

    let current = stack.pop();
    while (current !== undefined) {
      result.push(current);

      const children = childrenByParent.get(current.handle);
      if (children) {
        for (const child of children) {
          stack.push(child);
        }
      }

      current = stack.pop();
    }

    return result;
  }

  /**
   * Registers a listener for a window manager event with a typed event payload.
   *
   * @param type - The window manager event name.
   * @param listener - Callback receiving the event and its detail payload.
   * @param options - Standard DOM listener options or the capture flag.
   */
  public override addEventListener<K extends keyof WindowManagerEventMap>(
    type: K,
    listener: (event: WindowManagerEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /**
   * Registers a listener for any event using the standard {@link EventTarget} API.
   *
   * @param type - The event name.
   * @param listener - Callback or object whose `handleEvent` method receives the event.
   * @param options - Standard DOM listener options or the capture flag.
   */
  public override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /** Registers an event listener; see the overloads for typed and generic event listeners. */
  public override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((event: CustomEvent) => void),
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }

  /**
   * Removes a listener for a typed window manager event.
   *
   * @param type - The window manager event name used during registration.
   * @param listener - The same callback passed to {@link addEventListener}.
   * @param options - Listener options; the capture flag must match the registration.
   */
  public override removeEventListener<K extends keyof WindowManagerEventMap>(
    type: K,
    listener: (event: WindowManagerEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  /**
   * Removes a listener using the standard {@link EventTarget} API.
   *
   * @param type - The event name used during registration.
   * @param listener - The same callback or listener object used during registration.
   * @param options - Listener options; the capture flag must match the registration.
   */
  public override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  /** Removes an event listener; see the overloads for typed and generic event listeners. */
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

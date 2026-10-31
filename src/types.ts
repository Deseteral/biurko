/**
 * Unique window identifier.
 */
export type WindowHandle = string & { readonly __brand: unique symbol };

/**
 * Configuration for creating a new window.
 */
export interface CreateWindowOptions {
  /** The display title for the window. */
  title: string;

  /**
   * Initial horizontal position (in pixels) in desktop coordinate space.
   * Both `x` and `y` must be supplied to use explicit coordinates. If either is omitted,
   * the configured {@link WindowPositionStrategy} determines both coordinates.
   */
  x?: number;

  /**
   * Initial vertical position (in pixels) in desktop coordinate space.
   * Both `x` and `y` must be supplied to use explicit coordinates. If either is omitted,
   * the configured {@link WindowPositionStrategy} determines both coordinates.
   */
  y?: number;

  /** Initial width of the window in pixels. */
  width: number;

  /** Initial height of the window in pixels. */
  height: number;

  /** Minimum width constraint enforced during resize. Defaults to `0`. */
  minWidth?: number;

  /** Minimum height constraint enforced during resize. Defaults to `0`. */
  minHeight?: number;
}

/**
 * Represents the position and dimensions of a window.
 */
export interface WindowRect {
  /** Horizontal position in pixels in desktop coordinate space. */
  x: number;

  /** Vertical position in pixels in desktop coordinate space. */
  y: number;

  /** Width of the window in pixels. */
  width: number;

  /** Height of the window in pixels. */
  height: number;
}

/**
 * Determines how the {@link WindowManager} positions new windows when explicit coordinates are not provided.
 *
 * - `"required"` - The caller must always provide `x` and `y`.
 * - `"offset-from-focused"` - The new window is placed at an offset from the currently focused window.
 *   If no window is focused, the offset is applied to the desktop origin `(0, 0)`.
 */
export type WindowPositionStrategy =
  | { readonly type: "required" }
  | { readonly type: "offset-from-focused"; readonly offsetX: number; readonly offsetY: number };

export const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
export type ResizeDirection = typeof RESIZE_DIRECTIONS[number];

/**
 * Determines how the {@link WindowManager} desktop behaves.
 *
 * - `"static"` - The desktop has no wheel-driven panning or zooming. Moving and resizing windows
 *   clamps their position to keep a small portion visible, not the entire window. Initial placement
 *   is not clamped, and descendants moved with a parent may overflow the desktop bounds.
 * - `"infinite-canvas"` - The desktop acts as an infinite canvas. Windows live inside a translatable
 *   world layer that can be moved with the mouse wheel or the viewport translate API, and window
 *   placement is not clamped to the viewport.
 */
export type DesktopMode =
  | { readonly type: "static" }
  | { readonly type: "infinite-canvas" };

/**
 * Determines which window content surfaces can receive pointer input events.
 *
 * - `"all"` - All window surfaces are interactive.
 * - `"focused-only"` - Only the currently focused window's surface is interactive.
 *
 * Drag regions (`data-biurko-drag-region`) and resize handles remain interactive in both modes.
 */
export type WindowInteractivity =
  | { readonly type: "all" }
  | { readonly type: "focused-only" };

/**
 * Configuration for a parent-child window relationship
 * (see {@link WindowManager.attachWindowToParent}).
 */
export interface WindowParentOptions {
  /**
   * Determines whether dragging a window tears it off its parent.
   *
   * @defaultValue `false`
   */
  detachOnDrag?: boolean;
}

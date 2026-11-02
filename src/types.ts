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
   * `placement` or the configured {@link WindowPositionStrategy} determines both coordinates.
   */
  x?: number;

  /**
   * Initial vertical position (in pixels) in desktop coordinate space.
   * Both `x` and `y` must be supplied to use explicit coordinates. If either is omitted,
   * `placement` or the configured {@link WindowPositionStrategy} determines both coordinates.
   */
  y?: number;

  /**
   * One-time placement relative to a window or a desktop/world rectangle.
   * Used when a complete `x`/`y` pair is not supplied, before the desktop position strategy.
   * Does not attach the window or track subsequent movement, resizing, or content changes.
   */
  placement?: WindowPlacement;

  /**
   * Initial width in pixels. Omit to track the content's intrinsic (max-content) width.
   */
  width?: number;

  /**
   * Initial height in pixels. Omit to track the content's height at the current width.
   */
  height?: number;

  /**
   * Whether the window can be resized by the user.
   * Does not affect programmatic resizing via {@link WindowManager.resizeWindow}.
   *
   * @defaultValue `true`
   */
  resizable?: boolean;

  /** Minimum width constraint enforced during resize. Defaults to `0`. */
  minWidth?: number;

  /** Minimum height constraint enforced during resize. Defaults to `0`. */
  minHeight?: number;

  /**
   * Overrides the desktop's `windowInteractivity` setting for this window's content surface.
   * `true` keeps the surface interactive regardless of focus; `false` disables pointer input
   * even when focused.
   * When omitted, the desktop setting applies.
   * Drag regions and resize handles remain interactive regardless of this option.
   */
  interactive?: boolean;
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

/** One-time anchor-relative placement in desktop/world coordinates, unaffected by pan or zoom. */
export interface WindowPlacement {
  /** An open window in this manager (sampled at creation), or a rectangle in desktop/world coordinates. */
  anchor: WindowHandle | WindowRect;

  /** Which outside edge of the anchor to place the new window against. */
  side: "top" | "right" | "bottom" | "left";

  /**
   * Alignment on the perpendicular axis: top-to-bottom for left/right, left-to-right for top/bottom.
   * `center` and `end` require the new window's explicit height for left/right, or width for top/bottom.
   * @defaultValue `"start"`
   */
  align?: "start" | "center" | "end";

  /**
   * Edge separation in world pixels; negative values overlap the anchor. Defaults to `0`.
   * Placement on the left requires explicit width; placement on top requires explicit height.
   * Missing required dimensions or a closed/unknown anchor handle throws before creating a window.
   */
  gap?: number;
}

/**
 * Determines how the {@link WindowManager} positions new windows when neither explicit coordinates
 * nor per-window placement is provided.
 *
 * - `"required"` - The caller must provide `x` and `y` or per-window `placement`.
 * - `"offset-from-focused"` - The new window is placed at an offset from the currently focused window.
 *   If no window is focused, the offset is applied to the desktop origin `(0, 0)`.
 */
export type WindowPositionStrategy =
  | { readonly type: "required" }
  | { readonly type: "offset-from-focused"; readonly offsetX: number; readonly offsetY: number };

export const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
export type ResizeDirection = (typeof RESIZE_DIRECTIONS)[number];

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
export type DesktopMode = { readonly type: "static" } | { readonly type: "infinite-canvas" };

/**
 * Determines which window content surfaces can receive pointer input events.
 *
 * - `"all"` - All window surfaces are interactive.
 * - `"focused-only"` - Only the currently focused window's surface is interactive.
 *
 * Drag regions (`data-biurko-drag-region`) and resize handles remain interactive in both modes.
 */
export type WindowInteractivity = { readonly type: "all" } | { readonly type: "focused-only" };

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

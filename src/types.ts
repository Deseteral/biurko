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

  /** Initial horizontal position (in pixels) in desktop coordinate space. */
  x: number;

  /** Initial vertical position (in pixels) in desktop coordinate space. */
  y: number;

  /** Initial width of the window in pixels. */
  width: number;

  /** Initial height of the window in pixels. */
  height: number;

  /** Minimum width constraint enforced during resize. Defaults to `0`. */
  minWidth?: number;

  /** Minimum height constraint enforced during resize. Defaults to `0`. */
  minHeight?: number;

  /**
   * A CSS selector identifying which elements inside the window surface act as drag handles.
   * Clicking and dragging on elements matching this selector will move the window.
   *
   * @defaultValue `"[data-biurko-drag-region]"`
   */
  dragRegionSelector?: string;
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

export const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
export type ResizeDirection = typeof RESIZE_DIRECTIONS[number];

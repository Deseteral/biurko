import type { WindowHandle } from "./types.ts";

/** Event detail emitted when a new window is created. */
export interface WindowOpenedEventDetail {
  /** The handle of the newly created window. */
  handle: WindowHandle;
}

/** Event detail emitted when a window is closed. */
export interface WindowClosedEventDetail {
  /** The handle of the closed window. */
  handle: WindowHandle;
}

/** Event detail emitted when a window is brought to front. */
export interface WindowFocusedEventDetail {
  /** The handle of the focused window. */
  handle: WindowHandle;
}

/** Event detail emitted when a window drag operation completes. */
export interface WindowMovedEventDetail {
  /** The handle of the moved window. */
  handle: WindowHandle;

  /** The new horizontal position after the move. */
  x: number;

  /** The new vertical position after the move. */
  y: number;
}

/** Event detail emitted when a window resize operation completes. */
export interface WindowResizedEventDetail {
  /** The handle of the resized window. */
  handle: WindowHandle;

  /** The new horizontal position after the resize. */
  x: number;

  /** The new vertical position after the resize. */
  y: number;

  /** The new width after the resize. */
  width: number;

  /** The new height after the resize. */
  height: number;
}

export interface WindowManagerEventMap {
  "window-opened": CustomEvent<WindowOpenedEventDetail>;
  "window-closed": CustomEvent<WindowClosedEventDetail>;
  "window-focused": CustomEvent<WindowFocusedEventDetail>;
  "window-moved": CustomEvent<WindowMovedEventDetail>;
  "window-resized": CustomEvent<WindowResizedEventDetail>;
}

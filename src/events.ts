import type { WindowHandle } from "./types.ts";

export interface WindowOpenedEventDetail {
  handle: WindowHandle;
}

export interface WindowCloseEventDetail {
  handle: WindowHandle;
}

export interface WindowFocusEventDetail {
  handle: WindowHandle;
}

export interface WindowMoveEventDetail {
  handle: WindowHandle;
  x: number;
  y: number;
}

export interface WindowResizeEventDetail {
  handle: WindowHandle;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowManagerEventMap {
  "window-opened": CustomEvent<WindowOpenedEventDetail>;
  "window-closed": CustomEvent<WindowCloseEventDetail>;
  "window-focused": CustomEvent<WindowFocusEventDetail>;
  "window-moved": CustomEvent<WindowMoveEventDetail>;
  "window-resized": CustomEvent<WindowResizeEventDetail>;
}

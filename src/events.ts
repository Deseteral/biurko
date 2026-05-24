import type { WindowHandle } from "./types.ts";

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
  "window-closed": CustomEvent<WindowCloseEventDetail>;
  "window-focused": CustomEvent<WindowFocusEventDetail>;
  "window-moved": CustomEvent<WindowMoveEventDetail>;
  "window-resized": CustomEvent<WindowResizeEventDetail>;
}

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
  "window-close": CustomEvent<WindowCloseEventDetail>;
  "window-focus": CustomEvent<WindowFocusEventDetail>;
  "window-move": CustomEvent<WindowMoveEventDetail>;
  "window-resize": CustomEvent<WindowResizeEventDetail>;
}

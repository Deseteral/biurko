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

/** Event detail emitted by a successful focus call, even if the window was already focused. */
export interface WindowFocusedEventDetail {
  /** The handle of the focused window. */
  handle: WindowHandle;
}

/**
 * Event detail emitted when a window drag gesture completes, even if its position did not change.
 * Only the dragged window emits this event, not descendants moved with it.
 * Programmatic calls to `moveWindow` do not emit this event.
 */
export interface WindowMovedEventDetail {
  /** The handle of the moved window. */
  handle: WindowHandle;

  /** The horizontal position after the drag, in pixels in desktop coordinate space. */
  x: number;

  /** The vertical position after the drag, in pixels in desktop coordinate space. */
  y: number;
}

/**
 * Event detail emitted when a window resize gesture completes, even if its size did not change.
 * Programmatic calls to `resizeWindow` do not emit this event.
 */
export interface WindowResizedEventDetail {
  /** The handle of the resized window. */
  handle: WindowHandle;

  /** The horizontal position after the resize, in pixels in desktop coordinate space. */
  x: number;

  /** The vertical position after the resize, in pixels in desktop coordinate space. */
  y: number;

  /** The width after the resize, in pixels. */
  width: number;

  /** The height after the resize, in pixels. */
  height: number;
}

/** Event detail emitted when a window's parent relationship changes. */
export interface WindowParentChangedEventDetail {
  /** The handle of the window whose parent changed. */
  handle: WindowHandle;

  /** The previous parent handle, or `null` if the window was a root. */
  previousParent: WindowHandle | null;

  /** The new parent handle, or `null` if the window has become a root. */
  parent: WindowHandle | null;
}

/**
 * Event detail emitted when the stored viewport translation changes.
 * Offsets are the requested values and may differ from the browser-clamped scroll position.
 */
export interface ViewportTranslatedEventDetail {
  /** New horizontal translate offset of the world layer, in pixels. */
  x: number;

  /** New vertical translate offset of the world layer, in pixels. */
  y: number;
}

/** Maps window manager event names to their custom event payloads. */
export interface WindowManagerEventMap {
  "window-opened": CustomEvent<WindowOpenedEventDetail>;
  "window-closed": CustomEvent<WindowClosedEventDetail>;
  "window-focused": CustomEvent<WindowFocusedEventDetail>;
  "window-moved": CustomEvent<WindowMovedEventDetail>;
  "window-resized": CustomEvent<WindowResizedEventDetail>;
  "window-parent-changed": CustomEvent<WindowParentChangedEventDetail>;
  "viewport-translated": CustomEvent<ViewportTranslatedEventDetail>;
}

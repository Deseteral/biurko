export type {
  WindowHandle,
  CreateWindowOptions,
  WindowRect,
  WindowPositionStrategy,
  DesktopMode,
  WindowParentOptions,
} from "./types.ts";
export type {
  WindowOpenedEventDetail,
  WindowClosedEventDetail,
  WindowFocusedEventDetail,
  WindowMovedEventDetail,
  WindowResizedEventDetail,
  WindowParentChangedEventDetail,
  ViewportTranslatedEventDetail,
  WindowManagerEventMap,
} from "./events.ts";
export { WindowManager } from "./window-manager.ts";
export type { WindowManagerOptions } from "./window-manager.ts";

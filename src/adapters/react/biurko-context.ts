import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { type WindowManager } from "../../window-manager.ts";
import { type WindowHandle } from "../../types.ts";

/**
 * A `WindowManager` instance typed for the React adapter.
 * Each window's attached data is a render function returning a React node.
 */
export type ReactWindowManager = WindowManager<() => ReactNode>;

export const BiurkoContext = createContext<ReactWindowManager | null>(null);
export const CurrentWindowContext = createContext<WindowHandle | null>(null);

/**
 * Returns the current window's handle from its content or custom chrome.
 * Each window rendered by `<BiurkoDesktop>` provides its own handle, including
 * while its `renderWindow` decorator and content render function execute.
 *
 * @returns The handle of the enclosing window.
 * @throws Error if called outside a window, including from ordinary desktop children.
 */
export function useCurrentWindowHandle(): WindowHandle {
  const handle = useContext(CurrentWindowContext);
  if (handle === null) {
    throw new Error("useCurrentWindowHandle must be used within a React adapter window.");
  }
  return handle;
}

/**
 * Returns the {@link WindowManager} instance from the nearest `<BiurkoDesktop>` ancestor.
 * Use this hook to create, close, or inspect windows from any component within the desktop tree.
 *
 * @returns The desktop's window manager, with a content render function attached to each window.
 * @throws Error if called outside of a `<BiurkoDesktop>` component tree.
 */
export function useWindowManager(): ReactWindowManager {
  const windowManager = useContext(BiurkoContext);
  if (!windowManager) {
    throw new Error("useWindowManager must be used within React adapter context.");
  }
  return windowManager;
}

/**
 * Returns the direct children of a window in creation order.
 * Updates on attachment, detachment (including drag-to-detach), reparenting, and closure.
 * The readonly array retains its identity while its contents are unchanged.
 * A closed or unknown handle has no children.
 *
 * @param handle - The parent window to observe; may change between renders.
 * @throws Error if called outside of a `<BiurkoDesktop>` component tree.
 */
export function useWindowChildren(handle: WindowHandle): readonly WindowHandle[] {
  const windowManager = useWindowManager();
  const store = useMemo(() => {
    let children = windowManager.getChildren(handle);

    const getSnapshot = (): readonly WindowHandle[] => {
      const next = windowManager.getChildren(handle);
      if (next.length !== children.length || next.some((child, index) => child !== children[index])) {
        children = next;
      }
      return children;
    };

    const subscribe = (onStoreChange: () => void): (() => void) => {
      windowManager.addEventListener("window-parent-changed", onStoreChange);
      windowManager.addEventListener("window-closed", onStoreChange);
      return () => {
        windowManager.removeEventListener("window-parent-changed", onStoreChange);
        windowManager.removeEventListener("window-closed", onStoreChange);
      };
    };

    return { getSnapshot, subscribe };
  }, [windowManager, handle]);

  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

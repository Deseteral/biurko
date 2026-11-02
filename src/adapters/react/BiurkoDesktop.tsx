import { type ReactNode, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WindowManager, type WindowManagerOptions } from "../../window-manager.ts";
import { type WindowHandle } from "../../types.ts";
import { BiurkoContext, CurrentWindowContext, type ReactWindowManager } from "./biurko-context.ts";

interface WindowEntry {
  handle: WindowHandle;
  surface: HTMLDivElement;
  render: () => ReactNode;
}

/**
 * Props for the {@link BiurkoDesktop} component.
 */
export interface BiurkoDesktopProps {
  /** CSS class name applied to the desktop container. */
  className?: string;

  /**
   * Child components rendered inside the desktop.
   */
  children: ReactNode;

  /**
   * Configuration options passed to the underlying {@link WindowManager}.
   * Read only when the manager is initialized; later changes do not reconfigure it.
   */
  options?: WindowManagerOptions;

  /**
   * Optional render function to wrap each window's content with custom chrome (title bar, close button, etc.).
   * Runs within that window's context, so it and the components it returns can use `useCurrentWindowHandle`.
   *
   * @param handle - The handle of the window being rendered.
   * @param content - A function that returns the window's content (the render function passed to `createWindow`).
   * @returns The decorated window content to be portaled into the window surface.
   */
  renderWindow?: (handle: WindowHandle, content: () => ReactNode) => ReactNode;
}

// Invoke render callbacks in a child component so the window and manager providers
// are already ancestors when the callbacks execute.
function WindowContent({
  entry,
  renderWindow,
}: {
  entry: WindowEntry;
  renderWindow: BiurkoDesktopProps["renderWindow"];
}): ReactNode {
  return renderWindow ? renderWindow(entry.handle, entry.render) : entry.render();
}

/**
 * The root desktop component for the React adapter.
 * Initializes a {@link WindowManager} and provides it via React context. All windows created through
 * the manager are rendered as React portals into their respective surface elements.
 *
 * Place your application UI (taskbar, menus, controls) as `children` - they will have access to
 * the window manager through the {@link useWindowManager} hook.
 * Pass a content render function as the second argument to the manager's `createWindow` method.
 *
 * @param props - Desktop configuration, child UI, and optional window content decorator.
 * @returns The desktop container with child UI and window portals once initialized.
 */
export function BiurkoDesktop(props: BiurkoDesktopProps): ReactNode {
  const [windowManager, setWindowManager] = useState<ReactWindowManager | null>(null);
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const managerRef = useRef<ReactWindowManager | null>(null);

  const initRef = useCallback((el: HTMLDivElement | null): void => {
    if (!el || managerRef.current) return;

    const manager: ReactWindowManager = new WindowManager<() => ReactNode>(el, props.options);

    manager.addEventListener("window-opened", (e) => {
      const { handle } = e.detail;
      const surface = manager.getWindowSurface(handle);
      const render = manager.getWindowData(handle);
      if (!surface || !render) return;
      setWindows((prev) => [...prev, { handle, surface, render }]);
    });

    manager.addEventListener("window-closed", (e) => {
      setWindows((prev) => prev.filter((w) => w.handle !== e.detail.handle));
    });

    managerRef.current = manager;
    setWindowManager(manager);
  }, []);

  return (
    <div ref={initRef} className={props.className}>
      {windowManager && (
        <BiurkoContext.Provider value={windowManager}>
          {props.children}

          {windows.map((w) =>
            createPortal(
              <CurrentWindowContext.Provider value={w.handle}>
                <WindowContent entry={w} renderWindow={props.renderWindow} />
              </CurrentWindowContext.Provider>,
              w.surface,
              w.handle,
            ),
          )}
        </BiurkoContext.Provider>
      )}
    </div>
  );
}

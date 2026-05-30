import { type ReactNode, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WindowManager } from '../../window-manager.ts';
import { type WindowHandle } from '../../types.ts';
import { BiurkoContext, type ReactWindowManager } from './biurko-context.ts';

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
   * Optional render function to wrap each window's content with custom chrome (title bar, close button, etc.).
   *
   * @param handle - The handle of the window being rendered.
   * @param content - A function that returns the window's content (the render function passed to `createWindow`).
   * @returns The decorated window content to be portaled into the window surface.
   */
  renderWindow?: (handle: WindowHandle, content: () => ReactNode) => ReactNode;
}

/**
 * The root desktop component for the React adapter.
 * Initializes a {@link WindowManager} and provides it via React context. All windows created through
 * the manager are rendered as React portals into their respective surface elements.
 *
 * Place your application UI (taskbar, menus, controls) as `children` - they will have access to
 * the window manager through the {@link useWindowManager} hook.
 */
export function BiurkoDesktop(props: BiurkoDesktopProps): ReactNode {
  const [windowManager, setWindowManager] = useState<ReactWindowManager | null>(null);
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const managerRef = useRef<ReactWindowManager | null>(null);

  const initRef = useCallback((el: HTMLDivElement | null): void => {
    if (!el || managerRef.current) return;

    const manager: ReactWindowManager = new WindowManager<() => ReactNode>(el);

    manager.addEventListener('window-opened', (e) => {
      const { handle } = e.detail;
      const surface = manager.getWindowSurface(handle);
      const render = manager.getWindowData(handle);
      if (!surface || !render) return;
      setWindows((prev) => [...prev, { handle, surface, render }]);
    });

    manager.addEventListener('window-closed', (e) => {
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
              props.renderWindow ? props.renderWindow(w.handle, w.render) : w.render(),
              w.surface,
              w.handle,
            ),
          )}
        </BiurkoContext.Provider>
      )}
    </div>
  );
}

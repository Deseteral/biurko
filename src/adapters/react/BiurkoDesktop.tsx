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

export interface BiurkoDesktopProps {
  className?: string;
  children: ReactNode;
  renderWindow?: (handle: WindowHandle, content: () => ReactNode) => ReactNode;
}

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

/** @jsxImportSource solid-js */
import { createSignal, For, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { WindowManager } from '../../window-manager.ts';
import { type WindowHandle } from '../../types.ts';
import { BiurkoContext, type SolidJsWindowManager } from './biurko-context.ts';

interface WindowEntry {
  handle: WindowHandle;
  surface: HTMLDivElement;
  render: () => JSX.Element;
}

/**
 * Props for the {@link BiurkoDesktop} component.
 */
export interface BiurkoDesktopProps {
  /** CSS class name applied to the desktop container. */
  class?: string;

  /**
   * Child components rendered inside the desktop.
   */
  children: JSX.Element;

  /**
   * Optional render function to wrap each window's content with custom chrome (title bar, close button, etc.).
   *
   * @param handle - The handle of the window being rendered.
   * @param content - A function that returns the window's content (the render function passed to `createWindow`).
   * @returns The decorated window content to be portaled into the window surface.
   */
  renderWindow?: (handle: WindowHandle, content: () => JSX.Element) => JSX.Element;
}

/**
 * The root desktop component for the SolidJS adapter.
 * Initializes a {@link WindowManager} and provides it via SolidJS context. All windows created through
 * the manager are rendered as SolidJS portals into their respective surface elements.
 *
 * Place your application UI (taskbar, menus, controls) as `children` — they will have access to
 * the window manager through the {@link useWindowManager} function.
 */
export function BiurkoDesktop(props: BiurkoDesktopProps) {
  const [windowManager, setWindowManager] = createSignal<SolidJsWindowManager>();
  const [windows, setWindows] = createSignal<WindowEntry[]>([]);

  const initRef = (el: HTMLDivElement) => {
    const manager: SolidJsWindowManager = new WindowManager<() => JSX.Element>(el);

    manager.addEventListener('window-opened', (e) => {
      const { handle } = e.detail;
      const surface = manager.getWindowSurface(handle)!;
      const render = manager.getWindowData(handle)!;
      setWindows((prev) => [...prev, { handle, surface, render }]);
    });

    manager.addEventListener('window-closed', (e) => {
      setWindows((prev) => prev.filter((w) => w.handle !== e.detail.handle));
    });

    setWindowManager(manager);
  };

  return (
    <div ref={initRef} class={props.class}>
      <Show when={windowManager()}>
        {(manager) => (
          <BiurkoContext.Provider value={manager()}>
            {props.children}

            <For each={windows()}>
              {(w) => (
                <Portal
                  mount={w.surface}
                  // <Portal> generates a wrapper div that breaks biurko-surface layout.
                  // display: contents removes it from the box tree.
                  ref={(el) => { el.style.display = 'contents'; }}
                >
                  {props.renderWindow ? props.renderWindow(w.handle, w.render) : w.render()}
                </Portal>
              )}
            </For>
          </BiurkoContext.Provider>
        )}
      </Show>
    </div>
  );
}

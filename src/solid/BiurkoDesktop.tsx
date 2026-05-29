import { createSignal, For, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { WindowManager } from '../window-manager.ts';
import { type WindowHandle } from '../types.ts';
import { BiurkoContext, type SolidJsWindowManager } from './biurko-context.ts';

interface WindowEntry {
  handle: WindowHandle;
  surface: HTMLDivElement;
  render: () => JSX.Element;
}

export interface BiurkoDesktopProps {
  class?: string;
  children: JSX.Element;
  renderWindow?: (handle: WindowHandle, content: () => JSX.Element) => JSX.Element;
}

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

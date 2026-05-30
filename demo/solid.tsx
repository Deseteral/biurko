/** @jsxImportSource solid-js */
import { createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import type { WindowHandle } from "../src";
import { BiurkoDesktop, useWindowManager } from "../src/adapters/solid-js";

function CounterContent(): JSX.Element {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <div>Count: {count()}</div>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  );
}

function WindowChrome(props: { handle: WindowHandle; children: JSX.Element }): JSX.Element {
  const windowManager = useWindowManager();

  return (
    <div>
      <div data-biurko-drag-region class="title-bar">
        <span>{windowManager.getWindowTitle(props.handle)}</span>
        <button onClick={() => windowManager.closeWindow(props.handle)}>Close</button>
      </div>
      {props.children}
    </div>
  );
}

function DesktopControls(): JSX.Element {
  const windowManager = useWindowManager();

  const addWindow = (): void => {
    windowManager.createWindow(
      {
        title: "Hello from Solid!",
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      },
      () => <CounterContent />,
    );
  };

  return (
    <div class="desktop-button-list">
      <a href="/">Vanilla demo</a>
      <a href="/react.html">React demo</a>
      <button onClick={addWindow}>Add window</button>
    </div>
  );
}

function App(): JSX.Element {
  return (
    <BiurkoDesktop
      class="biurko-desktop"
      renderWindow={(handle, content) => (
        <WindowChrome handle={handle}>{content()}</WindowChrome>
      )}
    >
      <DesktopControls />
    </BiurkoDesktop>
  );
}

render(() => <App />, document.getElementById("root")!);

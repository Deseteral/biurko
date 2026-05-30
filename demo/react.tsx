import { type ReactNode, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { WindowHandle } from "../src";
import { BiurkoDesktop, useWindowManager } from "../src/adapters/react";

function CounterContent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  );
}

function WindowChrome({ handle, children }: { handle: WindowHandle; children: ReactNode }) {
  const windowManager = useWindowManager();

  return (
    <div>
      <div data-biurko-drag-region className="title-bar">
        <span>{windowManager.getWindowTitle(handle)}</span>
        <button onClick={() => windowManager.closeWindow(handle)}>Close</button>
      </div>
      {children}
    </div>
  );
}

function DesktopControls() {
  const windowManager = useWindowManager();

  const addWindow = () => {
    windowManager.createWindow(
      {
        title: "Hello from React!",
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      },
      () => <CounterContent />,
    );
  };

  return (
    <div className="desktop-button-list">
      <a href="/">Vanilla demo</a>
      <a href="/solid.html">Solid.js demo</a>
      <button onClick={addWindow}>Add window</button>
    </div>
  );
}

function App() {
  return (
    <BiurkoDesktop
      className="biurko-desktop"
      renderWindow={(handle, content) => (
        <WindowChrome handle={handle}>{content()}</WindowChrome>
      )}
    >
      <DesktopControls />
    </BiurkoDesktop>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import React from 'react';
import { StrictMode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { WindowManager } from "../src";
import type { WindowHandle } from "../src";

interface WindowEntry {
  handle: WindowHandle;
  surface: HTMLElement;
}

function WindowContent({ onClose }: { onClose: () => void }) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <div data-biurko-drag-region className="title-bar">Counter</div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      <button onClick={() => setCount(0)}>Reset</button>
      <button onClick={onClose}>Close</button>
    </div>
  );
}

function App() {
  const desktopRef = useRef<HTMLDivElement>(null);
  const wmRef = useRef<WindowManager | null>(null);
  const [windows, setWindows] = useState<WindowEntry[]>([]);

  const initDesktop = (el: HTMLDivElement | null) => {
    if (!el || wmRef.current) return;
    desktopRef.current = el;
    wmRef.current = new WindowManager(el);
  };

  const addWindow = () => {
    const wm = wmRef.current;
    if (!wm) return;

    const handle = wm.createWindow({
      title: "Counter",
      x: 60 + Math.random() * 200,
      y: 60 + Math.random() * 200,
      width: 300,
      height: 200,
      minWidth: 200,
      minHeight: 150,
    });

    const surface = wm.getWindowSurface(handle);
    if (surface) {
      setWindows((prev) => [...prev, { handle, surface }]);
    }
  };

  const closeWindow = (handle: WindowHandle) => {
    const wm = wmRef.current;
    if (!wm) return;
    wm.closeWindow(handle);
    setWindows((prev) => prev.filter((w) => w.handle !== handle));
  };

  return (
    <>
      <div id="desktop" ref={initDesktop}>
        <div className="desktop-button-list">
          <a href="/">Vanilla demo</a>
          <button onClick={addWindow}>Add window</button>
        </div>
      </div>
      {windows.map((w) =>
        createPortal(
          <WindowContent onClose={() => closeWindow(w.handle)} />,
          w.surface,
        ),
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

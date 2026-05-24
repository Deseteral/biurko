import type {WindowHandle} from "./types.ts";
import {WindowManager} from "./window-manager.ts";
import type {WindowMoveEventDetail} from "./events.ts";

export interface DragState {
  start(handle: WindowHandle, clientX: number, clientY: number): void;
}

export function createDragState(wm: WindowManager): DragState {
  let activeHandle: WindowHandle | null = null;
  let offsetX = 0;
  let offsetY = 0;

  function onMouseMove(e: MouseEvent): void {
    if (!activeHandle) return;

    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    wm.moveWindow(activeHandle, newX, newY);
  }

  function onMouseUp(): void {
    if (activeHandle) {
      const rect = wm.getWindowRect(activeHandle);
      if (rect) {
        wm.dispatchEvent(new CustomEvent<WindowMoveEventDetail>("window-moved", {
          detail: {handle: activeHandle, x: rect.x, y: rect.y},
        }));
      }
    }

    activeHandle = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  return {
    start(handle: WindowHandle, clientX: number, clientY: number): void {
      const rect = wm.getWindowRect(handle);
      if (!rect) return;

      activeHandle = handle;
      offsetX = clientX - rect.x;
      offsetY = clientY - rect.y;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
  };
}

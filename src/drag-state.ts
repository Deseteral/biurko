import type {WindowHandle} from "./types.ts";
import {WindowManager} from "./window-manager.ts";
import type {WindowMovedEventDetail} from "./events.ts";

export interface DragState {
  start(handle: WindowHandle, clientX: number, clientY: number): void;

  /** Returns `true` while a drag gesture is in progress. */
  isActive(): boolean;
}

export function createDragState(wm: WindowManager<unknown>): DragState {
  let activeHandle: WindowHandle | null = null;
  let offsetX = 0;
  let offsetY = 0;

  function onMouseMove(e: MouseEvent): void {
    if (!activeHandle) return;

    const pointer = wm.clientToWorld(e.clientX, e.clientY);
    wm.moveWindow(activeHandle, pointer.x - offsetX, pointer.y - offsetY);
  }

  function onMouseUp(): void {
    if (activeHandle) {
      const rect = wm.getWindowRect(activeHandle);
      if (rect) {
        wm.dispatchEvent(new CustomEvent<WindowMovedEventDetail>("window-moved", {
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

      const origin = wm.clientToWorld(clientX, clientY);

      activeHandle = handle;
      offsetX = origin.x - rect.x;
      offsetY = origin.y - rect.y;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },

    isActive(): boolean {
      return activeHandle !== null;
    },
  };
}

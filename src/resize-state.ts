import type {ResizeDirection, WindowHandle, WindowRect} from "./types.ts";
import type {WindowManager} from "./window-manager.ts";
import type {WindowResizedEventDetail} from "./events.ts";

export interface ResizeState {
  start(handle: WindowHandle, direction: ResizeDirection, clientX: number, clientY: number): void;
}

export function createResizeState(wm: WindowManager<any>): ResizeState {
  let activeHandle: WindowHandle | null = null;
  let activeDirection: ResizeDirection | null = null;
  let startX = 0;
  let startY = 0;
  let startRect: WindowRect = {x: 0, y: 0, width: 0, height: 0};
  let minWidth = 0;
  let minHeight = 0;

  function start(handle: WindowHandle, direction: ResizeDirection, clientX: number, clientY: number): void {
    const rect = wm.getWindowRect(handle);
    if (!rect) return;

    const minSize = wm.getMinSize(handle);
    if (!minSize) return;

    activeHandle = handle;
    activeDirection = direction;
    startX = clientX;
    startY = clientY;
    startRect = {...rect};
    minWidth = minSize.minWidth;
    minHeight = minSize.minHeight;

    wm.getDesktopElement().style.userSelect = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent): void {
    if (!activeHandle || !activeDirection) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newX = startRect.x;
    let newY = startRect.y;
    let newWidth = startRect.width;
    let newHeight = startRect.height;

    // Horizontal component.
    if (activeDirection.includes("e")) { // Grow in x-axis.
      newWidth = Math.max(minWidth, startRect.width + dx);
    } else if (activeDirection.includes("w")) { // Shrink in x-axis.
      const proposedWidth = startRect.width - dx;
      if (proposedWidth >= minWidth) {
        newWidth = proposedWidth;
        newX = startRect.x + dx;
      } else {
        newWidth = minWidth;
        newX = startRect.x + (startRect.width - minWidth);
      }
    }

    // Vertical component.
    if (activeDirection.includes("s")) { // Grow in y-axis.
      newHeight = Math.max(minHeight, startRect.height + dy);
    } else if (activeDirection.includes("n")) { // Shrink in y-axis.
      const proposedHeight = startRect.height - dy;
      if (proposedHeight >= minHeight) {
        newHeight = proposedHeight;
        newY = startRect.y + dy;
      } else {
        newHeight = minHeight;
        newY = startRect.y + (startRect.height - minHeight);
      }
    }

    wm.resizeWindow(activeHandle, newX, newY, newWidth, newHeight);
  }

  function onMouseUp(): void {
    if (activeHandle) {
      const rect = wm.getWindowRect(activeHandle);
      if (rect) {
        wm.dispatchEvent(new CustomEvent<WindowResizedEventDetail>("window-resized", {
          detail: {handle: activeHandle, x: rect.x, y: rect.y, width: rect.width, height: rect.height},
        }));
      }
    }

    activeHandle = null;
    activeDirection = null;
    wm.getDesktopElement().style.userSelect = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  return {
    start,
  };
}

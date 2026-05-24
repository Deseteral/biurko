import type {ResizeDirection} from "./types.ts";

export function applyResizeRegionStyles(el: HTMLDivElement, direction: ResizeDirection, regionSize: number): void {
  el.style.position = "absolute";
  el.style.zIndex = "1";
  el.style.cursor = `${direction}-resize`;

  // Handles are regionSize inside + regionSize outside the window edge (2 * regionSize total).
  const size = regionSize * 2;
  const offset = `-${regionSize}px`;
  const cornerSize = `${size}px`;
  const origin = `${regionSize}px`;

  switch (direction) {
    case "n":
      el.style.top = offset;
      el.style.left = origin;
      el.style.right = origin;
      el.style.height = `${size}px`;
      break;
    case "s":
      el.style.bottom = offset;
      el.style.left = origin;
      el.style.right = origin;
      el.style.height = `${size}px`;
      break;
    case "e":
      el.style.right = offset;
      el.style.top = origin;
      el.style.bottom = origin;
      el.style.width = `${size}px`;
      break;
    case "w":
      el.style.left = offset;
      el.style.top = origin;
      el.style.bottom = origin;
      el.style.width = `${size}px`;
      break;
    case "ne":
      el.style.top = offset;
      el.style.right = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
    case "nw":
      el.style.top = offset;
      el.style.left = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
    case "se":
      el.style.bottom = offset;
      el.style.right = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
    case "sw":
      el.style.bottom = offset;
      el.style.left = offset;
      el.style.width = cornerSize;
      el.style.height = cornerSize;
      break;
  }
}

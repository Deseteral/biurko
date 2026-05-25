export type WindowHandle = string & { readonly __brand: unique symbol };

export interface WindowOptions {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  dragRegionSelector?: string;
}

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
export type ResizeDirection = typeof RESIZE_DIRECTIONS[number];

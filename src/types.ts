export type WindowHandle = string & { readonly __brand: unique symbol };

export interface WindowOptions {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
}

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

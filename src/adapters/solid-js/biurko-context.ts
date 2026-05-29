import { createContext, type JSX, useContext } from 'solid-js';
import { type WindowManager } from '../../window-manager.ts';

export type SolidJsWindowManager = WindowManager<() => JSX.Element>;

export const BiurkoContext = createContext<SolidJsWindowManager>();

export function useWindowManager(): SolidJsWindowManager {
  const windowManager = useContext(BiurkoContext);
  if (!windowManager) {
    throw new Error('useWindowManager must be used within Solid.js adapter context.');
  }
  return windowManager;
}

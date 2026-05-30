import { createContext, type JSX, useContext } from 'solid-js';
import { type WindowManager } from '../../window-manager.ts';

/**
 * A `WindowManager` instance typed for the Solid.js adapter.
 * Each window's attached data is a Solid's component render function.
 */
export type SolidJsWindowManager = WindowManager<() => JSX.Element>;

export const BiurkoContext = createContext<SolidJsWindowManager>();

/**
 * Returns the {@link WindowManager} instance from the nearest `<BiurkoDesktop>` ancestor.
 * Use this to create, close, or inspect windows from any component within the desktop tree.
 *
 * @throws Error if called outside of a `<BiurkoDesktop>` component tree.
 */
export function useWindowManager(): SolidJsWindowManager {
  const windowManager = useContext(BiurkoContext);
  if (!windowManager) {
    throw new Error('useWindowManager must be used within Solid.js adapter context.');
  }
  return windowManager;
}

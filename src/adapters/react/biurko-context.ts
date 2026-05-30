import { createContext, type ReactNode, useContext } from 'react';
import { type WindowManager } from '../../window-manager.ts';

/**
 * A `WindowManager` instance typed for the React adapter.
 * Each window's attached data is a React's component render function.
 */
export type ReactWindowManager = WindowManager<() => ReactNode>;

export const BiurkoContext = createContext<ReactWindowManager | null>(null);

/**
 * Returns the {@link WindowManager} instance from the nearest `<BiurkoDesktop>` ancestor.
 * Use this hook to create, close, or inspect windows from any component within the desktop tree.
 *
 * @throws Error if called outside of a `<BiurkoDesktop>` component tree.
 */
export function useWindowManager(): ReactWindowManager {
  const windowManager = useContext(BiurkoContext);
  if (!windowManager) {
    throw new Error('useWindowManager must be used within React adapter context.');
  }
  return windowManager;
}

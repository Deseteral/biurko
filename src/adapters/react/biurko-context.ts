import { createContext, type ReactNode, useContext } from 'react';
import { type WindowManager } from '../../window-manager.ts';

export type ReactWindowManager = WindowManager<() => ReactNode>;

export const BiurkoContext = createContext<ReactWindowManager | null>(null);

export function useWindowManager(): ReactWindowManager {
  const windowManager = useContext(BiurkoContext);
  if (!windowManager) {
    throw new Error('useWindowManager must be used within React adapter context.');
  }
  return windowManager;
}

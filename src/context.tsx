import { createContext, useContext } from 'react';
import type { Group, Item, Settings, Store } from './store/types';

export interface AddDefaults {
  date?: string | null;
  groupId?: string | null;
}

export interface AppCtx {
  store: Store;
  today: string;
  items: Item[];
  groups: Group[];
  settings: Settings;
  groupName: (id: string | null) => string | null;
  addFromText: (text: string, defaults?: AddDefaults) => void;
  toggleDone: (item: Item) => void;
  openItem: (item: Item) => void;
  toggleSchoolDday: (key: string) => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext 밖에서 사용');
  return ctx;
}

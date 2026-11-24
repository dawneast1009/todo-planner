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
  /** 이름으로 그룹을 찾고, 없으면 만든다. 그룹 id를 돌려준다. */
  ensureGroup: (name: string) => string;
  addFromText: (text: string, defaults?: AddDefaults) => void;
  toggleDone: (item: Item) => void;
  /** 삭제 (아래에 '되돌리기'가 뜬다) */
  deleteItem: (item: Item) => void;
  /** 여러 항목의 날짜를 한 번에 바꾼다 (미루기). '되돌리기'가 뜬다. */
  moveItems: (items: Item[], date: string, label: string) => void;
  openItem: (item: Item) => void;
  toggleSchoolDday: (key: string) => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext 밖에서 사용');
  return ctx;
}

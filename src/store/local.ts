import { DEFAULT_SETTINGS, type Group, type Item, type Settings, type Snapshot, type Store } from './types';

// Firebase 설정이 없을 때 쓰는 저장소. 이 브라우저에만 저장된다.
const KEY = 'todo-planner:data:v1';

interface Data {
  items: Item[];
  groups: Group[];
  settings: Settings;
}

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Data>;
      return {
        items: d.items ?? [],
        groups: d.groups ?? [],
        settings: { ...DEFAULT_SETTINGS, ...d.settings },
      };
    }
  } catch {
    // 손상된 데이터는 무시하고 빈 상태로 시작
  }
  return { items: [], groups: [], settings: { ...DEFAULT_SETTINGS } };
}

export function createLocalStore(): Store {
  let data = load();
  const listeners = new Set<(s: Snapshot) => void>();

  const snapshot = (): Snapshot => ({ ready: true, ...data });
  const emit = () => listeners.forEach((cb) => cb(snapshot()));

  const commit = (next: Data) => {
    data = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // 저장 공간 부족 등: 메모리에는 남아 있다
    }
    emit();
  };

  // 다른 탭에서 바꾸면 따라간다
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      data = load();
      emit();
    }
  });

  return {
    mode: 'local',
    subscribe(cb) {
      listeners.add(cb);
      cb(snapshot());
      return () => listeners.delete(cb);
    },
    putItem(item) {
      const items = data.items.filter((i) => i.id !== item.id);
      commit({ ...data, items: [...items, item] });
    },
    removeItem(id) {
      commit({ ...data, items: data.items.filter((i) => i.id !== id) });
    },
    putGroup(group) {
      const groups = data.groups.filter((g) => g.id !== group.id);
      commit({ ...data, groups: [...groups, group] });
    },
    removeGroup(id) {
      commit({
        ...data,
        groups: data.groups.filter((g) => g.id !== id),
        items: data.items.map((i) => (i.groupId === id ? { ...i, groupId: null, updatedAt: Date.now() } : i)),
      });
    },
    putSettings(settings) {
      commit({ ...data, settings });
    },
  };
}

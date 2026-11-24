import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { AppContext, type AddDefaults, type AppCtx } from './context';
import { ItemSheet } from './components/ItemSheet';
import { SignIn } from './components/SignIn';
import { useSnapshot, useToday } from './hooks';
import { parseQuickInput } from './lib/parse';
import { ChangePassword } from './components/ChangePassword';
import { createFirebaseStore, firebaseEnabled, hasPassword, logOut, watchUser } from './store/firebase';
import { createLocalStore } from './store/local';
import { newId, type Item, type Store } from './store/types';
import { MainView } from './views/MainView';
import { SettingsView } from './views/SettingsView';

export function App() {
  return firebaseEnabled ? <CloudApp /> : <LocalApp />;
}

function LocalApp() {
  const store = useMemo(() => createLocalStore(), []);
  return (
    <Main
      store={store}
      account={
        <p className="hint">
          이 기기(브라우저)에만 저장하고 있어요. 폰과 PC에서 같이 보려면 Firebase를 연결하세요. (레포의 docs/setup.md 참고)
        </p>
      }
    />
  );
}

function CloudApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => watchUser(setUser), []);
  const uid = user?.uid;
  const store = useMemo(() => (uid ? createFirebaseStore(uid) : null), [uid]);

  if (user === undefined) return <div className="splash">불러오는 중…</div>;
  if (!user || !store) return <SignIn />;
  return (
    <Main
      store={store}
      account={
        <>
          <div className="btn-row">
            <span>{user.email ?? '로그인됨'}</span>
            <button
              onClick={() => {
                if (confirm('로그아웃할까요?')) void logOut();
              }}
            >
              로그아웃
            </button>
          </div>
          {hasPassword(user) && (
            <div className="account-extra">
              <ChangePassword />
            </div>
          )}
        </>
      }
    />
  );
}

function Main({ store, account }: { store: Store; account: React.ReactNode }) {
  const snap = useSnapshot(store);
  const today = useToday();
  const [page, setPage] = useState<'main' | 'settings'>('main');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { items, groups, settings } = snap;

  const groupName = useCallback((id: string | null) => groups.find((g) => g.id === id)?.name ?? null, [groups]);

  const addFromText = useCallback(
    (text: string, defaults: AddDefaults = {}) => {
      const p = parseQuickInput(text, today);
      let groupId = defaults.groupId ?? null;
      if (p.group) {
        const existing = groups.find((g) => g.name.toLowerCase() === p.group!.toLowerCase());
        if (existing) groupId = existing.id;
        else {
          groupId = newId();
          store.putGroup({ id: groupId, name: p.group, createdAt: Date.now() });
        }
      }
      const date = p.date ?? defaults.date ?? null;
      const now = Date.now();
      const item: Item = {
        id: newId(),
        title: p.title,
        memo: '',
        date,
        time: p.time,
        // 시간이 붙으면 약속(일정)으로 본다. '~까지'는 마감이라 할 일로 둔다.
        kind: date && p.time && !text.includes('까지') ? 'event' : 'todo',
        done: false,
        doneOn: null,
        important: false,
        groupId,
        createdAt: now,
        updatedAt: now,
      };
      store.putItem(item);
    },
    [groups, store, today],
  );

  const ctx: AppCtx = {
    store,
    today,
    items,
    groups,
    settings,
    groupName,
    addFromText,
    toggleDone: (item) =>
      store.putItem({
        ...item,
        done: !item.done,
        doneOn: item.done ? null : today,
        updatedAt: Date.now(),
      }),
    openItem: (item) => setEditingId(item.id),
    toggleSchoolDday: (key) => {
      const list = settings.importantSchoolEvents;
      store.putSettings({
        ...settings,
        importantSchoolEvents: list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
      });
    },
  };

  const editing = editingId ? items.find((i) => i.id === editingId) : undefined;

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <main className={`content${page === 'main' ? ' wide' : ''}`}>
          {!snap.ready ? (
            <p className="empty">불러오는 중…</p>
          ) : page === 'main' ? (
            <MainView onOpenSettings={() => setPage('settings')} />
          ) : (
            <SettingsView account={account} onBack={() => setPage('main')} />
          )}
        </main>
        {editing && <ItemSheet key={editing.id} item={editing} onClose={() => setEditingId(null)} />}
      </div>
    </AppContext.Provider>
  );
}

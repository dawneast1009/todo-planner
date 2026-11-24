import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { AppContext, type AddDefaults, type AppCtx } from './context';
import { ItemSheet } from './components/ItemSheet';
import { SignIn } from './components/SignIn';
import { useSnapshot, useToday } from './hooks';
import { parseQuickInput } from './lib/parse';
import { ChangePassword } from './components/ChangePassword';
import { SyncBadge } from './components/SyncBadge';
import { Toast, type ToastState } from './components/Toast';
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
          {user.email && <ChangePassword email={user.email} hasPassword={hasPassword(user)} />}
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((text: string, undo?: () => void) => setToast({ id: Date.now(), text, undo }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const { items, groups, settings } = snap;

  const groupName = useCallback((id: string | null) => groups.find((g) => g.id === id)?.name ?? null, [groups]);

  const ensureGroup = useCallback(
    (raw: string) => {
      const name = raw.trim().replace(/^#/, '');
      const existing = groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      const id = newId();
      store.putGroup({ id, name, createdAt: Date.now() });
      return id;
    },
    [groups, store],
  );

  const addFromText = useCallback(
    (text: string, defaults: AddDefaults = {}) => {
      const p = parseQuickInput(text, today);
      // 글 안의 #그룹이 고른 그룹보다 우선
      const groupId = p.group ? ensureGroup(p.group) : (defaults.groupId ?? null);
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
    [ensureGroup, store, today],
  );

  const ctx: AppCtx = {
    store,
    today,
    items,
    groups,
    settings,
    groupName,
    ensureGroup,
    addFromText,
    toggleDone: (item) => {
      store.putItem({
        ...item,
        done: !item.done,
        doneOn: item.done ? null : today,
        updatedAt: Date.now(),
      });
      if (!item.done) showToast(`'${item.title}' 완료`, () => store.putItem(item));
    },
    deleteItem: (item) => {
      store.removeItem(item.id);
      showToast(`'${item.title}' 삭제했어요`, () => store.putItem(item));
    },
    moveItems: (list, date, label) => {
      if (list.length === 0) return;
      const now = Date.now();
      list.forEach((it) => store.putItem({ ...it, date, updatedAt: now }));
      showToast(`${list.length}개를 ${label}로 옮겼어요`, () => list.forEach((it) => store.putItem(it)));
    },
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
        <SyncBadge sync={snap.sync} />
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
        <Toast toast={toast} onClose={closeToast} />
      </div>
    </AppContext.Provider>
  );
}

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS, type Group, type Item, type Settings, type Snapshot, type Store } from './types';

// 설정값은 빌드할 때 환경변수로 들어온다 (.env.local 또는 GitHub Variables).
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function init() {
  if (!firebaseEnabled) throw new Error('Firebase 설정이 없습니다');
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    void setPersistence(auth, browserLocalPersistence);
    // 오프라인에서도 읽고 쓸 수 있게 기기에 캐시해 둔다
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return { auth: auth!, db: db! };
}

export function watchUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(init().auth, cb);
}

export async function signInGoogle() {
  await signInWithPopup(init().auth, new GoogleAuthProvider());
}

export async function signInEmail(email: string, password: string, create: boolean) {
  const { auth } = init();
  if (create) await createUserWithEmailAndPassword(auth, email, password);
  else await signInWithEmailAndPassword(auth, email, password);
}

export async function logOut() {
  await signOut(init().auth);
}

// Firestore는 undefined 값을 거부하므로 저장 전에 정리한다
function clean<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

function report(e: unknown) {
  console.error('저장 실패', e);
}

export function createFirebaseStore(uid: string): Store {
  const { db } = init();
  const base = `users/${uid}`;
  const itemsCol = collection(db, base, 'items');
  const groupsCol = collection(db, base, 'groups');
  const settingsDoc = doc(db, base, 'meta', 'settings');

  let items: Item[] = [];
  let groups: Group[] = [];
  let settings: Settings = { ...DEFAULT_SETTINGS };
  const loaded = { items: false, groups: false, settings: false };
  const listeners = new Set<(s: Snapshot) => void>();
  let unsubs: Array<() => void> = [];

  const snapshot = (): Snapshot => ({
    ready: loaded.items && loaded.groups && loaded.settings,
    items,
    groups,
    settings,
  });
  const emit = () => listeners.forEach((cb) => cb(snapshot()));

  const start = () => {
    unsubs = [
      onSnapshot(itemsCol, (snap) => {
        items = snap.docs.map((d) => d.data() as Item);
        loaded.items = true;
        emit();
      }),
      onSnapshot(groupsCol, (snap) => {
        groups = snap.docs.map((d) => d.data() as Group);
        loaded.groups = true;
        emit();
      }),
      onSnapshot(settingsDoc, (snap) => {
        settings = { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) };
        loaded.settings = true;
        emit();
      }),
    ];
  };

  // 쓰기는 기다리지 않는다: 오프라인이면 서버에 닿을 때까지 끝나지 않지만
  // 로컬 캐시에는 바로 반영되고 onSnapshot이 즉시 불린다.
  return {
    mode: 'cloud',
    subscribe(cb) {
      listeners.add(cb);
      if (listeners.size === 1) start();
      cb(snapshot());
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0) {
          unsubs.forEach((u) => u());
          unsubs = [];
        }
      };
    },
    putItem(item) {
      setDoc(doc(itemsCol, item.id), clean(item)).catch(report);
    },
    removeItem(id) {
      deleteDoc(doc(itemsCol, id)).catch(report);
    },
    putGroup(group) {
      setDoc(doc(groupsCol, group.id), clean(group)).catch(report);
    },
    removeGroup(id) {
      const batch = writeBatch(db);
      batch.delete(doc(groupsCol, id));
      for (const it of items) {
        if (it.groupId === id) batch.update(doc(itemsCol, it.id), { groupId: null, updatedAt: Date.now() });
      }
      batch.commit().catch(report);
    },
    putSettings(next) {
      setDoc(settingsDoc, clean(next)).catch(report);
    },
  };
}

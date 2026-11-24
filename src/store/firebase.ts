import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
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
  type SnapshotListenOptions,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS, type Group, type Item, type Settings, type Snapshot, type Store } from './types';

// 설정값은 빌드할 때 환경변수로 들어온다 (.env.local 또는 GitHub Variables).
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  // 푸시 알림(FCM)에 필요
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};
// Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시징 → 웹 푸시 인증서 (공개 키라 비밀이 아니다)
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);
/** 알림에 필요한 설정값이 빌드에 들어있는지 */
export const pushConfigured = firebaseEnabled && Boolean(vapidKey && config.messagingSenderId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function init() {
  if (!firebaseEnabled) throw new Error('Firebase 설정이 없습니다');
  if (!app) {
    app = initializeApp(config);
    // getAuth는 기본으로 로그인을 브라우저(IndexedDB)에 저장해서 껐다 켜도 유지된다.
    // 시작할 때 setPersistence를 따로 부르면 저장된 로그인을 읽는 것과 겹칠 수 있어서 부르지 않는다.
    auth = getAuth(app);
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

/** 비밀번호를 잊었을 때: 재설정 링크를 메일로 보낸다 */
export async function sendPasswordReset(email: string) {
  const { auth } = init();
  auth.languageCode = 'ko';
  await sendPasswordResetEmail(auth, email);
}

/** 로그인한 상태에서 비밀번호 바꾸기. Firebase가 최근 로그인을 요구해서 현재 비밀번호로 한 번 더 확인한다. */
export async function changePassword(current: string, next: string) {
  const user = init().auth.currentUser;
  if (!user?.email) throw new Error('로그인 상태가 아니에요');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}

/** 이메일/비밀번호로 가입한 계정인지 (Google 계정은 비밀번호가 없다) */
export function hasPassword(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'password');
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.',
  'auth/wrong-password': '비밀번호가 맞지 않아요.',
  'auth/invalid-email': '이메일 형식이 아니에요.',
  'auth/missing-email': '이메일을 적어주세요.',
  'auth/email-already-in-use': '이미 있는 계정이에요. 로그인을 눌러주세요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 뒤에 다시 해주세요.',
  'auth/popup-closed-by-user': '로그인 창이 닫혔어요.',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이 로그인 방법이 꺼져 있어요.',
  'auth/unauthorized-domain': '이 주소가 Firebase 승인 도메인에 없어요. (docs/setup.md 참고)',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
};

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code;
  return (code && AUTH_MESSAGES[code]) || (e instanceof Error ? e.message : String(e));
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

  // 아직 서버에 안 올라간 변경이 있는지 (컬렉션별)
  const pending = { items: false, groups: false, settings: false };
  let online = navigator.onLine;

  const snapshot = (): Snapshot => ({
    ready: loaded.items && loaded.groups && loaded.settings,
    sync: !online ? 'offline' : pending.items || pending.groups || pending.settings ? 'pending' : 'ok',
    items,
    groups,
    settings,
  });
  const emit = () => listeners.forEach((cb) => cb(snapshot()));
  const onOnline = () => {
    online = navigator.onLine;
    emit();
  };

  // includeMetadataChanges: 서버에 올라가서 pending이 풀릴 때도 알림을 받는다
  const meta: SnapshotListenOptions = { includeMetadataChanges: true };
  const start = () => {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    unsubs = [
      onSnapshot(itemsCol, meta, (snap) => {
        items = snap.docs.map((d) => d.data() as Item);
        loaded.items = true;
        pending.items = snap.metadata.hasPendingWrites;
        emit();
      }),
      onSnapshot(groupsCol, meta, (snap) => {
        groups = snap.docs.map((d) => d.data() as Group);
        loaded.groups = true;
        pending.groups = snap.metadata.hasPendingWrites;
        emit();
      }),
      onSnapshot(settingsDoc, meta, (snap) => {
        settings = { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) };
        loaded.settings = true;
        pending.settings = snap.metadata.hasPendingWrites;
        emit();
      }),
      () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOnline);
      },
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
    async replaceAll(nextItems, nextGroups) {
      // 한 번에 쓸 수 있는 개수 제한(500)이 있어서 나눠서 커밋한다
      type Op = (b: ReturnType<typeof writeBatch>) => void;
      const keepItems = new Set(nextItems.map((i) => i.id));
      const keepGroups = new Set(nextGroups.map((g) => g.id));
      const ops: Op[] = [
        ...items.filter((i) => !keepItems.has(i.id)).map((i): Op => (b) => b.delete(doc(itemsCol, i.id))),
        ...groups.filter((g) => !keepGroups.has(g.id)).map((g): Op => (b) => b.delete(doc(groupsCol, g.id))),
        ...nextGroups.map((g): Op => (b) => b.set(doc(groupsCol, g.id), clean(g))),
        ...nextItems.map((i): Op => (b) => b.set(doc(itemsCol, i.id), clean(i))),
      ];
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(db);
        ops.slice(i, i + 400).forEach((op) => op(batch));
        await batch.commit();
      }
    },
  };
}

// ---------- 푸시 알림 ----------

const DEVICE_KEY = 'todo-planner:push-device';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  return '기기';
}

/** 이 브라우저가 푸시 알림을 받을 수 있는지 */
export async function pushSupported(): Promise<boolean> {
  if (!pushConfigured || !('Notification' in window) || !('serviceWorker' in navigator)) return false;
  const { isSupported } = await import('firebase/messaging');
  return isSupported();
}

/** 이 기기에서 알림을 켰는지 (권한 + 등록 기록) */
export function pushEnabledHere(): boolean {
  return 'Notification' in window && Notification.permission === 'granted' && !!localStorage.getItem(DEVICE_KEY);
}

/** 알림 권한을 받고 이 기기의 알림 주소(토큰)를 내 계정에 저장한다 */
export async function enablePush(uid: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 꺼져 있어요. 브라우저(또는 폰 설정 → 앱 → 알림)에서 이 사이트 알림을 허용해 주세요.');
  }
  const { getMessaging, getToken } = await import('firebase/messaging');
  init();
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app!), { vapidKey, serviceWorkerRegistration: registration });
  const id = (await sha256(token)).slice(0, 40);
  await setDoc(doc(db!, 'users', uid, 'devices', id), { token, label: deviceLabel(), createdAt: Date.now() });
  localStorage.setItem(DEVICE_KEY, id);
}

/** 이 기기 알림 끄기 */
export async function disablePush(uid: string): Promise<void> {
  const id = localStorage.getItem(DEVICE_KEY);
  const { deleteToken, getMessaging } = await import('firebase/messaging');
  init();
  try {
    await deleteToken(getMessaging(app!));
  } catch {
    // 이미 없는 토큰이어도 괜찮다
  }
  if (id) await deleteDoc(doc(db!, 'users', uid, 'devices', id));
  localStorage.removeItem(DEVICE_KEY);
}

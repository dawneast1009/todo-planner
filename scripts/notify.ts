// GitHub Actions에서 몇 분마다 돌며 알림을 보낸다.
// 공개 레포라 Actions 로그를 누구나 볼 수 있다. 할 일 내용·계정 정보는 로그에 남기지 않고 개수만 찍는다.
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { EMPTY_NOTIFY_STATE, planNotifications, seoulNow, type NotifyState } from '../src/lib/notify';
import { DEFAULT_SETTINGS, type Item, type Settings } from '../src/store/types';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('FIREBASE_SERVICE_ACCOUNT가 없어서 알림을 건너뜁니다. (docs/setup.md의 알림 설정 참고)');
  process.exit(0);
}

const appUrl = process.env.APP_URL ?? '';
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();
const messaging = getMessaging();
const { today, nowMin } = seoulNow();

// 이 토큰은 더 이상 못 쓰니 지워도 되는 오류들
const DEAD_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

let users = 0;
let sent = 0;
let failed = 0;
let removed = 0;

for (const userRef of await db.collection('users').listDocuments()) {
  const [devicesSnap, itemsSnap, settingsSnap, stateSnap] = await Promise.all([
    userRef.collection('devices').get(),
    userRef.collection('items').get(),
    userRef.collection('meta').doc('settings').get(),
    userRef.collection('meta').doc('notify-state').get(),
  ]);
  if (devicesSnap.empty) continue;
  users++;

  const items = itemsSnap.docs.map((d) => d.data() as Item);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(settingsSnap.data() as Partial<Settings> | undefined) };
  const prev: NotifyState = { ...EMPTY_NOTIFY_STATE, ...(stateSnap.data() as Partial<NotifyState> | undefined) };
  const plan = planNotifications(items, settings, prev, today, nowMin);

  for (const m of plan.messages) {
    for (const dev of devicesSnap.docs) {
      try {
        // data 메시지로 보내고, 앱의 서비스 워커(push-sw.js)가 알림을 띄운다
        await messaging.send({
          token: dev.get('token') as string,
          data: { title: m.title, body: m.body, tag: m.tag, url: appUrl },
          webpush: { headers: { Urgency: 'high', TTL: '3600' } },
        });
        sent++;
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (DEAD_TOKEN.has(code)) {
          await dev.ref.delete();
          removed++;
        } else {
          failed++;
          console.error('보내기 실패:', code || (e instanceof Error ? e.message : 'unknown'));
        }
      }
    }
  }

  if (JSON.stringify(plan.state) !== JSON.stringify(prev)) {
    await userRef.collection('meta').doc('notify-state').set(plan.state);
  }
}

console.log(`알림 확인 완료 (${today} ${Math.floor(nowMin / 60)}:${String(nowMin % 60).padStart(2, '0')} KST): 기기 있는 계정 ${users}, 보냄 ${sent}, 실패 ${failed}, 지운 토큰 ${removed}`);
if (failed > 0) process.exitCode = 1;

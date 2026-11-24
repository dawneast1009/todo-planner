import { useEffect, useState } from 'react';
import { useApp } from '../context';
import {
  disablePush,
  enablePush,
  firebaseEnabled,
  pushConfigured,
  pushEnabledHere,
  pushSupported,
} from '../store/firebase';
import { DEFAULT_NOTIFY, type NotifySettings } from '../store/types';

const MORNING_TIMES = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'];
const LEADS = [10, 30, 60];

/** 설정 → 알림. 이 기기 알림 켜기/끄기와 언제 알릴지. */
export function NotificationSettings({ uid }: { uid: string | null }) {
  const { settings, store } = useApp();
  const notify = { ...DEFAULT_NOTIFY, ...settings.notify };
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(pushEnabledHere());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    void pushSupported().then(setSupported);
  }, []);

  const update = (patch: Partial<NotifySettings>) =>
    store.putSettings({ ...settings, notify: { ...notify, ...patch } });

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ text: ok });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setEnabled(pushEnabledHere());
      setBusy(false);
    }
  };

  // 서버를 거치지 않고 이 기기에서 바로 띄워 보는 미리보기 (권한·표시 확인용)
  const preview = async () => {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('알림 미리보기', { body: '이렇게 알림이 와요', icon: 'icon-192.png', tag: 'preview' });
  };

  let body: React.ReactNode;
  if (!firebaseEnabled || !uid) {
    body = <p className="hint">알림은 로그인해서 동기화할 때만 쓸 수 있어요.</p>;
  } else if (!pushConfigured) {
    body = (
      <p className="hint">
        알림 준비가 아직 안 됐어요. 레포의 docs/setup.md에 있는 "알림 설정"을 먼저 해야 해요.
      </p>
    );
  } else if (supported === false) {
    body = <p className="hint">이 브라우저는 알림을 받을 수 없어요. 폰에서는 Chrome으로 열어 주세요.</p>;
  } else {
    body = (
      <>
        <div className="btn-row">
          {enabled ? (
            <>
              <span>이 기기에서 알림을 받고 있어요</span>
              <button disabled={busy} onClick={() => void preview()}>
                미리보기
              </button>
              <button disabled={busy} onClick={() => void run(() => disablePush(uid), '이 기기 알림을 껐어요.')}>
                끄기
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={busy || supported === null}
              onClick={() => void run(() => enablePush(uid), '이 기기에서 알림을 받아요.')}
            >
              이 기기에서 알림 켜기
            </button>
          )}
        </div>
        <div className="field-row notify-options">
          <label>
            아침 요약
            <select value={notify.morning} onChange={(e) => update({ morning: e.target.value })}>
              <option value="">끄기</option>
              {MORNING_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            시간 있는 일정
            <select value={notify.eventLead} onChange={(e) => update({ eventLead: Number(e.target.value) })}>
              <option value={0}>끄기</option>
              {LEADS.map((m) => (
                <option key={m} value={m}>
                  {m}분 전
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">알림은 5분마다 확인해서 보내요. 몇 분 늦게 올 수 있어요. 폰과 PC 각각에서 켜야 그 기기로 와요.</p>
      </>
    );
  }

  return (
    <section className="card">
      <h2>알림</h2>
      {body}
      {message && <p className={message.error ? 'error' : 'hint'}>{message.text}</p>}
    </section>
  );
}

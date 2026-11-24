import { useState } from 'react';
import { authErrorMessage, changePassword, sendPasswordReset } from '../store/firebase';

/**
 * 설정 → 계정의 비밀번호 칸.
 * 현재 비밀번호를 알면 바로 바꾸고, 모르면 재설정 메일을 받는다.
 */
export function ChangePassword({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendReset = () =>
    run(async () => {
      await sendPasswordReset(email);
      setNotice(`${email}(으)로 비밀번호 재설정 메일을 보냈어요. 메일의 링크에서 새 비밀번호를 정하면 돼요. 안 보이면 스팸함도 확인해 주세요.`);
    });

  const mismatch = confirmNext.length > 0 && next !== confirmNext;

  return (
    <div className="password-box">
      <h3 className="sub-title">비밀번호 변경</h3>
      {hasPassword ? (
        <form
          className="password-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (next !== confirmNext) return;
            void run(async () => {
              await changePassword(current, next);
              setCurrent('');
              setNext('');
              setConfirmNext('');
              setNotice('비밀번호를 바꿨어요. 다른 기기에서는 새 비밀번호로 다시 로그인해야 할 수 있어요.');
            });
          }}
        >
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="현재 비밀번호"
            autoComplete="current-password"
            aria-label="현재 비밀번호"
          />
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            autoComplete="new-password"
            aria-label="새 비밀번호"
          />
          <input
            type="password"
            value={confirmNext}
            onChange={(e) => setConfirmNext(e.target.value)}
            placeholder="새 비밀번호 확인"
            autoComplete="new-password"
            aria-label="새 비밀번호 확인"
          />
          {mismatch && <p className="error">새 비밀번호가 서로 달라요.</p>}
          <div className="btn-row">
            <button
              type="submit"
              className="primary"
              disabled={busy || !current || next.length < 6 || next !== confirmNext}
            >
              비밀번호 바꾸기
            </button>
            <button type="button" className="ghost small link-btn" disabled={busy} onClick={() => void sendReset()}>
              현재 비밀번호를 몰라요
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="hint">Google로 로그인한 계정이에요. 메일을 받아 비밀번호를 정하면 이메일로도 로그인할 수 있어요.</p>
          <button disabled={busy} onClick={() => void sendReset()}>
            비밀번호 설정 메일 받기
          </button>
        </>
      )}
      {notice && <p className="hint">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

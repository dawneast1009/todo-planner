import { useState } from 'react';
import { authErrorMessage, changePassword } from '../store/firebase';

/** 설정 화면의 비밀번호 변경. 평소엔 버튼만 보이고 누르면 펼쳐진다. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirmNext('');
    setError(null);
  };

  if (!open) {
    return (
      <>
        <button
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
        >
          비밀번호 변경
        </button>
        {done && <p className="hint">비밀번호를 바꿨어요.</p>}
      </>
    );
  }

  const mismatch = confirmNext.length > 0 && next !== confirmNext;

  return (
    <form
      className="password-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (next !== confirmNext) return;
        setBusy(true);
        setError(null);
        try {
          await changePassword(current, next);
          reset();
          setOpen(false);
          setDone(true);
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
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
      {error && <p className="error">{error}</p>}
      <div className="btn-row">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          취소
        </button>
        <button
          type="submit"
          className="primary"
          disabled={busy || !current || next.length < 6 || next !== confirmNext}
        >
          바꾸기
        </button>
      </div>
    </form>
  );
}

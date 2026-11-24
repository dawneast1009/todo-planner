import { useState } from 'react';
import { signInEmail, signInGoogle } from '../store/firebase';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.',
  'auth/invalid-email': '이메일 형식이 아니에요.',
  'auth/email-already-in-use': '이미 있는 계정이에요. 로그인을 눌러주세요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
  'auth/popup-closed-by-user': '로그인 창이 닫혔어요.',
  'auth/unauthorized-domain': '이 주소가 Firebase 승인 도메인에 없어요. (docs/setup.md 참고)',
};

function message(e: unknown): string {
  const code = (e as { code?: string }).code;
  return (code && MESSAGES[code]) || (e instanceof Error ? e.message : String(e));
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <h1>할 일·일정</h1>
      <p className="hint">폰과 PC에서 같은 목록을 보려면 로그인하세요. 처음 한 번만 하면 돼요.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => signInEmail(email, password, false));
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          autoComplete="email"
          aria-label="이메일"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          aria-label="비밀번호"
        />
        <div className="btn-row">
          <button type="submit" className="primary" disabled={busy || !email || !password}>
            로그인
          </button>
          <button
            type="button"
            disabled={busy || !email || !password}
            onClick={() => void run(() => signInEmail(email, password, true))}
          >
            처음이면 계정 만들기
          </button>
        </div>
      </form>
      <div className="divider">또는</div>
      <button disabled={busy} onClick={() => void run(signInGoogle)}>
        Google로 로그인
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

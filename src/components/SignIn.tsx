import { useState } from 'react';
import { authErrorMessage, sendPasswordReset, signInEmail } from '../store/firebase';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = () =>
    run(async () => {
      if (!email.trim()) throw Object.assign(new Error(), { code: 'auth/missing-email' });
      await sendPasswordReset(email.trim());
      // 없는 이메일이어도 Firebase는 성공으로 응답한다 (계정 존재 여부를 숨기려고)
      setNotice(`${email.trim()}(으)로 비밀번호 재설정 메일을 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요.`);
    });

  return (
    <div className="signin">
      <h1>할 일·일정</h1>
      <p className="hint">개인용 앱이에요. 내 계정으로 로그인하세요.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => signInEmail(email, password));
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
        {/* 새 계정 만들기는 Firebase 콘솔에서 막아 두고 화면에서도 뺐다 (개인용). */}
        <button type="submit" className="primary" disabled={busy || !email || !password}>
          로그인
        </button>
        <button type="button" className="ghost small link-btn" disabled={busy} onClick={() => void forgot()}>
          비밀번호를 잊었어요
        </button>
      </form>
      {notice && <p className="hint">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

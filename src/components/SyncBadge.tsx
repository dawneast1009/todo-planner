import { useEffect, useState } from 'react';
import type { SyncState } from '../store/types';

/**
 * 동기화 상태 안내. 평소(ok)에는 아무것도 안 보인다.
 * '올리는 중'은 보통 금방 끝나서 1.5초 넘게 걸릴 때만 보여준다 (깜빡임 방지).
 */
export function SyncBadge({ sync }: { sync: SyncState }) {
  const [slowPending, setSlowPending] = useState(false);
  useEffect(() => {
    if (sync !== 'pending') {
      setSlowPending(false);
      return;
    }
    const t = setTimeout(() => setSlowPending(true), 1500);
    return () => clearTimeout(t);
  }, [sync]);

  if (sync === 'offline') {
    return (
      <div className="sync-badge offline" role="status">
        오프라인이에요 · 적은 건 이 기기에 저장되고, 인터넷이 연결되면 자동으로 올라가요
      </div>
    );
  }
  if (sync === 'pending' && slowPending) {
    return (
      <div className="sync-badge" role="status">
        저장하는 중…
      </div>
    );
  }
  return null;
}

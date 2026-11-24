import { useEffect, useState } from 'react';
import { toISO } from './lib/date';
import type { Snapshot, Store } from './store/types';
import { DEFAULT_SETTINGS } from './store/types';

/** 자정이 지나거나 앱으로 돌아올 때 '오늘'을 다시 계산한다. */
export function useToday(): string {
  const [today, setToday] = useState(() => toISO(new Date()));
  useEffect(() => {
    const check = () => setToday(toISO(new Date()));
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const EMPTY: Snapshot = { ready: false, items: [], groups: [], settings: DEFAULT_SETTINGS };

export function useSnapshot(store: Store | null): Snapshot {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  useEffect(() => {
    if (!store) {
      setSnap(EMPTY);
      return;
    }
    return store.subscribe(setSnap);
  }, [store]);
  return snap;
}

interface CacheEntry<T> {
  at: number;
  data: T;
}

const CACHE_PREFIX = 'todo-planner:cache:';

function readCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // 캐시는 없어도 된다
  }
}

export interface Remote<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * 나이스 데이터처럼 자주 안 바뀌는 원격 데이터를 기기에 캐시하며 가져온다.
 * 캐시가 있으면 먼저 보여주고, 오래됐으면 뒤에서 새로 받는다.
 * key가 null이면 아무것도 하지 않는다.
 */
export function useCachedRemote<T>(key: string | null, fetcher: () => Promise<T>, maxAgeMs: number): Remote<T> {
  const [state, setState] = useState<Remote<T>>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!key) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    const cached = readCache<T>(key);
    const fresh = cached && Date.now() - cached.at < maxAgeMs;
    setState({ data: cached?.data ?? null, loading: !fresh, error: null });
    if (fresh) return;
    fetcher()
      .then((data) => {
        writeCache(key, data);
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            data: cached?.data ?? null,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
      });
    return () => {
      cancelled = true;
    };
    // fetcher는 key가 같으면 같은 요청이므로 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maxAgeMs]);

  return state;
}

// 한국 음력 변환. 브라우저에 내장된 단기(dangi) 달력을 쓴다 (별도 표 없이 정확한 한국 음력).
import { addDays } from './date';

export interface LunarDate {
  month: number;
  day: number;
  /** 윤달인지 */
  leap: boolean;
}

let fmt: Intl.DateTimeFormat | null = null;
function formatter(): Intl.DateTimeFormat | null {
  if (fmt) return fmt;
  try {
    const f = new Intl.DateTimeFormat('en-US-u-ca-dangi', {
      timeZone: 'UTC',
      month: 'numeric',
      day: 'numeric',
    });
    if (f.resolvedOptions().calendar !== 'dangi') return null;
    fmt = f;
    return f;
  } catch {
    return null;
  }
}

/** 이 브라우저에서 음력 계산이 되는지 */
export function lunarSupported(): boolean {
  return formatter() !== null;
}

const cache = new Map<string, LunarDate>();

/** 양력 'YYYY-MM-DD' → 음력. 지원 안 되는 브라우저면 null. */
export function toLunar(iso: string): LunarDate | null {
  const hit = cache.get(iso);
  if (hit) return hit;
  const f = formatter();
  if (!f) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const parts = f.formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  // 윤달은 '6bis' 처럼 온다
  const result = { month: parseInt(month, 10), day: parseInt(day, 10), leap: month.includes('bis') };
  cache.set(iso, result);
  return result;
}

/** 이 양력 날짜가 매년 음력 month월 day일에 해당하는지. 윤달은 치지 않고, 그 달에 30일이 없으면 29일로 본다. */
export function isLunarDay(iso: string, month: number, day: number): boolean {
  const l = toLunar(iso);
  if (!l || l.leap || l.month !== month) return false;
  if (l.day === day) return true;
  if (day === 30 && l.day === 29) {
    const next = toLunar(addDays(iso, 1));
    return !!next && (next.month !== month || next.leap);
  }
  return false;
}

/** '음력 10월 16일', 윤달이면 '음력 윤6월 1일' */
export function lunarLabel(iso: string): string | null {
  const l = toLunar(iso);
  if (!l) return null;
  return `음력 ${l.leap ? '윤' : ''}${l.month}월 ${l.day}일`;
}

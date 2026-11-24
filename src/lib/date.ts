// 날짜는 모두 기기 현지 시간 기준 'YYYY-MM-DD' 문자열로 다룬다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 존재하는 날짜일 때만 Date를 돌려준다 (예: 2월 30일 → null). */
export function makeDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** b - a (일 단위). */
export function diffDays(a: string, b: string): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[fromISO(iso).getDay()];
}

/** 해당 날짜가 속한 주의 월요일. */
export function mondayOf(iso: string): string {
  const day = fromISO(iso).getDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

export function compactISO(iso: string): string {
  return iso.replaceAll('-', '');
}

export function fromCompact(s: string): string {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** 'M/D (요일)'. today를 주면 올해가 아닌 날짜에 연도를 붙인다: '2027년 8/13 (금)' */
export function shortLabel(iso: string, today?: string): string {
  const d = fromISO(iso);
  const year = today && iso.slice(0, 4) !== today.slice(0, 4) ? `${d.getFullYear()}년 ` : '';
  return `${year}${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

/** 오늘 기준 상대 표현: 오늘, 내일, 모레, 그 외 '12/5 (금)' */
export function relativeLabel(iso: string, today: string): string {
  const n = diffDays(today, iso);
  if (n === 0) return '오늘';
  if (n === 1) return '내일';
  if (n === 2) return '모레';
  if (n === -1) return '어제';
  return shortLabel(iso, today);
}

export function ddayLabel(iso: string, today: string): string {
  const n = diffDays(today, iso);
  if (n === 0) return 'D-DAY';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

/** 'HH:mm' → '오후 3:00' */
export function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}

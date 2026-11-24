import type { Item, RepeatRule } from '../store/types';
import { addDays, diffDays, fromISO } from './date';
import { isLunarDay } from './lunar';

const WEEKDAY = '일월화수목금토';

export function repeatLabel(rule: RepeatRule): string {
  if (rule.freq === 'daily') return '매일';
  if (rule.freq === 'monthly') return `매월 ${rule.day}일`;
  if (rule.freq === 'yearly') return `매년 ${rule.lunar ? '음력 ' : ''}${rule.month}월 ${rule.day}일`;
  const days = [...rule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (days.join() === '1,2,3,4,5') return '평일';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말';
  if (days.length === 7) return '매일';
  return `매주 ${days.map((d) => WEEKDAY[d]).join('')}`;
}

function matches(rule: RepeatRule, iso: string): boolean {
  const d = fromISO(iso);
  if (rule.freq === 'daily') return true;
  if (rule.freq === 'weekly') return rule.days.includes(d.getDay());
  if (rule.freq === 'yearly') {
    if (rule.lunar) return isLunarDay(iso, rule.month, rule.day);
    if (d.getMonth() + 1 !== rule.month) return false;
    // 양력 2월 29일은 윤년이 아니면 2월 28일에
    const leapYear = new Date(d.getFullYear(), 1, 29).getMonth() === 1;
    if (rule.month === 2 && rule.day === 29 && !leapYear) return d.getDate() === 28;
    return d.getDate() === rule.day;
  }
  return d.getDate() === rule.day;
}

/** start 이후(포함) [from, to] 사이의 반복 날짜들. 너무 긴 범위는 400일로 자른다. */
export function occurrences(rule: RepeatRule, start: string, from: string, to: string): string[] {
  const begin = from > start ? from : start;
  const span = Math.min(diffDays(begin, to), 400);
  const out: string[] = [];
  for (let i = 0; i <= span; i++) {
    const iso = addDays(begin, i);
    if (matches(rule, iso)) out.push(iso);
  }
  return out;
}

/** from 이후(포함) 첫 반복 날짜. 없으면 null (안전장치). */
export function nextOccurrence(rule: RepeatRule, from: string): string | null {
  // 음력 한 해는 윤달이 있으면 384~385일이라 넉넉히 본다
  return occurrences(rule, from, from, addDays(from, 400))[0] ?? null;
}

/** 반복 항목 하나를 특정 날짜의 화면용 항목으로 만든다. */
export function occurrenceOf(series: Item, date: string): Item {
  const done = (series.doneDates ?? []).includes(date);
  return {
    ...series,
    id: `${series.id}@${date}`,
    seriesId: series.id,
    date,
    done,
    doneOn: done ? date : null,
  };
}

/**
 * 반복 항목을 [from, to] 사이 날짜별 항목으로 펼친다.
 * 반복 아닌 항목은 그대로 둔다. '이 날만 삭제'한 날짜는 뺀다.
 */
export function expandItems(items: Item[], from: string, to: string): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    if (!it.repeat || !it.date) {
      out.push(it);
      continue;
    }
    const skip = new Set(it.skipDates ?? []);
    for (const d of occurrences(it.repeat, it.date, from, to)) {
      if (!skip.has(d)) out.push(occurrenceOf(it, d));
    }
  }
  return out;
}

/** 반복 항목마다 today 이후(포함) 아직 안 한 다음 날짜 하나만 남긴다 (예정 목록용). */
export function nextOccurrences(items: Item[], after: string): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    if (!it.repeat || !it.date) continue;
    const skip = new Set(it.skipDates ?? []);
    const done = new Set(it.doneDates ?? []);
    const dates = occurrences(it.repeat, it.date, after, addDays(after, 400));
    const next = dates.find((d) => !skip.has(d) && !done.has(d));
    if (next) out.push(occurrenceOf(it, next));
  }
  return out;
}

/** 반복 시작 날짜: 기준일 이후 첫 반복 날짜 (기준일 포함) */
export function firstDateFor(rule: RepeatRule, from: string): string {
  return nextOccurrence(rule, from) ?? from;
}

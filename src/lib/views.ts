import type { Item } from '../store/types';
import type { SchoolEvent } from './neis';

/** 체크한 항목은 체크한 날 하루 동안만 줄 그어 보여준다. */
export function isShownInList(item: Item, today: string): boolean {
  return !item.done || item.doneOn === today;
}

function byTimeThenCreated(a: Item, b: Item): number {
  const ta = a.time ?? '99:99';
  const tb = b.time ?? '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.createdAt - b.createdAt;
}

function byDateThenTime(a: Item, b: Item): number {
  const da = a.date ?? '';
  const db = b.date ?? '';
  if (da !== db) return da < db ? -1 : 1;
  return byTimeThenCreated(a, b);
}

export interface TodayView {
  /** 지난 날짜인데 아직 체크 안 한 할 일 (자동 이월) */
  carried: Item[];
  /** 오늘 날짜인 할 일·일정 */
  today: Item[];
  /** 오늘 체크한 것 */
  done: Item[];
}

export function todayView(items: Item[], today: string): TodayView {
  const carried: Item[] = [];
  const todays: Item[] = [];
  const done: Item[] = [];
  for (const it of items) {
    if (!it.date) continue;
    if (it.done) {
      if (it.doneOn === today && it.date <= today) done.push(it);
      continue;
    }
    if (it.date === today) todays.push(it);
    // 일정(약속)은 지나가면 넘기지 않는다
    else if (it.date < today && it.kind === 'todo') carried.push(it);
  }
  return {
    carried: carried.sort(byDateThenTime),
    today: todays.sort(byTimeThenCreated),
    done: done.sort(byDateThenTime),
  };
}

export interface DateBucket {
  date: string;
  items: Item[];
}

/** 내일 이후 항목을 날짜별로 묶는다. */
export function upcomingView(items: Item[], today: string): DateBucket[] {
  const map = new Map<string, Item[]>();
  for (const it of items) {
    if (!it.date || it.date <= today || !isShownInList(it, today)) continue;
    const list = map.get(it.date) ?? [];
    list.push(it);
    map.set(it.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, list]) => ({ date, items: list.sort(byTimeThenCreated) }));
}

export function somedayView(items: Item[], today: string): Item[] {
  return items
    .filter((it) => !it.date && isShownInList(it, today))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** 그룹 화면: 날짜 있는 것은 날짜순, 날짜 없는 것은 뒤에. 지난 일정은 뺀다. */
export function groupView(items: Item[], groupId: string, today: string): Item[] {
  return items
    .filter(
      (it) =>
        it.groupId === groupId &&
        isShownInList(it, today) &&
        !(it.kind === 'event' && it.date && it.date < today && !it.done),
    )
    .sort((a, b) => {
      if (!a.date !== !b.date) return a.date ? -1 : 1;
      return byDateThenTime(a, b);
    });
}

export function itemsOnDate(items: Item[], date: string): Item[] {
  return items.filter((it) => it.date === date).sort(byTimeThenCreated);
}

export interface Dday {
  key: string;
  title: string;
  date: string;
  source: 'item' | 'school';
  itemId?: string;
}

export function schoolEventKey(e: Pick<SchoolEvent, 'date' | 'name'>): string {
  return `${e.date}|${e.name}`;
}

/**
 * 중요 표시한 항목과 D-day를 켠 학사일정 중 오늘 이후 것.
 * 학사일정은 API에서 못 받아와도 키에 날짜·이름이 있어서 그대로 보여줄 수 있다.
 */
export function ddayView(items: Item[], importantSchoolKeys: string[], today: string): Dday[] {
  const out: Dday[] = [];
  for (const it of items) {
    if (it.important && !it.done && it.date && it.date >= today) {
      out.push({ key: `item:${it.id}`, title: it.title, date: it.date, source: 'item', itemId: it.id });
    }
  }
  for (const key of importantSchoolKeys) {
    const sep = key.indexOf('|');
    const date = key.slice(0, sep);
    if (date >= today) out.push({ key: `school:${key}`, title: key.slice(sep + 1), date, source: 'school' });
  }
  return out.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1));
}

export interface GroupCard {
  groupId: string;
  /** 날짜 있는 것 날짜순, 그다음 날짜 없는 것 */
  items: Item[];
}

/**
 * 예정·언젠가 항목 중 그룹이 있는 것은 그룹별 카드로 묶고, 나머지는 날짜별로 둔다.
 * 그룹 카드는 가장 가까운 날짜가 있는 그룹부터 (날짜가 하나도 없는 그룹은 뒤로).
 */
export function splitByGroup(
  upcoming: Item[],
  someday: Item[],
  today: string,
): { cards: GroupCard[]; buckets: DateBucket[]; someday: Item[] } {
  const byGroup = new Map<string, Item[]>();
  for (const it of [...upcoming, ...someday]) {
    if (!it.groupId) continue;
    const list = byGroup.get(it.groupId) ?? [];
    list.push(it);
    byGroup.set(it.groupId, list);
  }
  const cards = [...byGroup.entries()]
    .map(([groupId, list]) => ({
      groupId,
      items: list.sort((a, b) => {
        if (!a.date !== !b.date) return a.date ? -1 : 1;
        return byDateThenTime(a, b);
      }),
    }))
    .sort((a, b) => {
      const da = a.items[0].date ?? '9999';
      const db = b.items[0].date ?? '9999';
      return da === db ? a.items[0].createdAt - b.items[0].createdAt : da < db ? -1 : 1;
    });
  return {
    cards,
    buckets: upcomingView(
      upcoming.filter((i) => !i.groupId),
      today,
    ),
    someday: someday.filter((i) => !i.groupId),
  };
}

import { useCachedRemote } from './hooks';
import { addDays, mondayOf } from './lib/date';
import {
  fetchMeals,
  fetchSchoolEvents,
  fetchTimetable,
  type MealsResult,
  type SchoolEventsResult,
  type TimetableResult,
} from './lib/neis';
import type { SchoolConfig, Settings } from './store/types';

const HOUR = 3_600_000;

function schoolKey(s: SchoolConfig): string {
  return `${s.officeCode}-${s.schoolCode}-${s.grade}-${s.className}`;
}

/**
 * 그 날짜가 속한 주(월~금) 시간표.
 * 키가 있으면 한 번에 받고, 키가 없으면 5건 제한 때문에 하루씩 따로 받아 합친다.
 */
export function useTimetable(settings: Settings, date: string) {
  const s = settings.school;
  const key = settings.neisKey;
  const monday = mondayOf(date);
  return useCachedRemote<TimetableResult>(
    s ? `tt3:${key ? 'k' : 'nk'}:${schoolKey(s)}:${monday}` : null,
    async () => {
      if (key) return fetchTimetable(s!, monday, addDays(monday, 4), key);
      const days = await Promise.all([0, 1, 2, 3, 4].map((n) => fetchTimetable(s!, addDays(monday, n), addDays(monday, n), '')));
      return {
        days: Object.assign({}, ...days.map((d) => d.days)),
        partial: days.some((d) => d.partial),
      };
    },
    6 * HOUR,
  );
}

/** 그 날짜가 속한 주(월~금) 급식. 키가 없으면 하루씩 받는다 (하루에 많아야 3끼라 5건 제한에 걸리지 않는다). */
export function useWeekMeals(settings: Settings, date: string) {
  const s = settings.school;
  const key = settings.neisKey;
  const monday = mondayOf(date);
  return useCachedRemote<MealsResult>(
    s ? `meal1:${key ? 'k' : 'nk'}:${s.officeCode}-${s.schoolCode}:${monday}` : null,
    async () => {
      if (key) return fetchMeals(s!, monday, addDays(monday, 4), key);
      const days = await Promise.all([0, 1, 2, 3, 4].map((n) => fetchMeals(s!, addDays(monday, n), addDays(monday, n), '')));
      return {
        days: Object.assign({}, ...days.map((d) => d.days)),
        partial: days.some((d) => d.partial),
      };
    },
    6 * HOUR,
  );
}

/**
 * 키 없이 학사일정 받기: 나이스가 한 번에 5건만 주니 기간을 쪼갠다.
 * 한 달을 주 단위로 받고, 그 주도 5건이 넘으면 하루씩 다시 받는다.
 */
export async function fetchEventsKeyless(
  school: SchoolConfig,
  month: string,
  fetchFn?: typeof fetch,
): Promise<SchoolEventsResult> {
  const weeks: Array<[string, string]> = [
    [`${month}-01`, `${month}-07`],
    [`${month}-08`, `${month}-14`],
    [`${month}-15`, `${month}-21`],
    [`${month}-22`, `${month}-28`],
    [`${month}-29`, `${month}-31`], // 나이스는 없는 날짜도 범위 끝으로 받아준다
  ];
  const results = await Promise.all(
    weeks.map(async ([from, to]) => {
      const r = await fetchSchoolEvents(school, from, to, '', fetchFn);
      if (!r.partial) return r;
      const days = Array.from({ length: Number(to.slice(8)) - Number(from.slice(8)) + 1 }, (_, i) =>
        addDays(from, i),
      ).filter((d) => d.startsWith(month));
      const perDay = await Promise.all(days.map((d) => fetchSchoolEvents(school, d, d, '', fetchFn)));
      return { events: perDay.flatMap((x) => x.events), partial: perDay.some((x) => x.partial) };
    }),
  );
  const seen = new Set<string>();
  const events = results
    .flatMap((r) => r.events)
    .filter((e) => {
      const k = `${e.date}|${e.name}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { events, partial: results.some((r) => r.partial) };
}

/** 'YYYY-MM' 한 달 학사일정 */
export function useMonthEvents(settings: Settings, month: string) {
  const s = settings.school;
  const key = settings.neisKey;
  return useCachedRemote<SchoolEventsResult>(
    s ? `ev4:${key ? 'k' : 'nk'}:${s.officeCode}-${s.schoolCode}:${month}` : null,
    () => (key ? fetchSchoolEvents(s!, `${month}-01`, `${month}-31`, key) : fetchEventsKeyless(s!, month)),
    12 * HOUR,
  );
}

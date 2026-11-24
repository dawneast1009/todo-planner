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

/** 'YYYY-MM' 한 달 학사일정 */
export function useMonthEvents(settings: Settings, month: string) {
  const s = settings.school;
  const key = settings.neisKey;
  const from = `${month}-01`;
  const to = `${month}-31`; // 나이스는 없는 날짜도 범위 끝으로 받아준다
  return useCachedRemote<SchoolEventsResult>(
    s ? `ev2:${key ? 'k' : 'nk'}:${s.officeCode}-${s.schoolCode}-${s.grade}:${month}` : null,
    () => fetchSchoolEvents(s!, from, to, key),
    12 * HOUR,
  );
}

import { useCachedRemote } from './hooks';
import { addDays, mondayOf } from './lib/date';
import { fetchSchoolEvents, fetchTimetable, type SchoolEventsResult, type TimetableResult } from './lib/neis';
import type { Settings } from './store/types';

const HOUR = 3_600_000;

/**
 * 시간표. 키가 있으면 그 주(월~금)를 한 번에 받아 캐시하고,
 * 키가 없으면 5건 제한 때문에 그 날 하루만 받는다.
 */
export function useTimetable(settings: Settings, date: string) {
  const s = settings.school;
  const key = settings.neisKey;
  const from = key ? mondayOf(date) : date;
  const to = key ? addDays(from, 4) : date;
  const mode = key ? 'k' : 'nk';
  return useCachedRemote<TimetableResult>(
    s ? `tt2:${mode}:${s.officeCode}-${s.schoolCode}-${s.grade}-${s.className}:${from}` : null,
    () => fetchTimetable(s!, from, to, key),
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

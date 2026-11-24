import { useCachedRemote } from './hooks';
import { addDays, mondayOf } from './lib/date';
import { fetchSchoolEvents, fetchTimetable, type Period, type SchoolEvent } from './lib/neis';
import type { Settings } from './store/types';

const HOUR = 3_600_000;

function schoolId(settings: Settings): string | null {
  const s = settings.school;
  return s ? `${s.officeCode}-${s.schoolCode}-${s.grade}-${s.className}` : null;
}

/** 그 날짜가 속한 주(월~금) 시간표를 한 번에 받아 캐시한다. */
export function useWeekTimetable(settings: Settings, date: string) {
  const id = schoolId(settings);
  const from = mondayOf(date);
  const to = addDays(from, 4);
  return useCachedRemote<Record<string, Period[]>>(
    id ? `tt:${id}:${from}` : null,
    () => fetchTimetable(settings.school!, from, to, settings.neisKey),
    6 * HOUR,
  );
}

/** 'YYYY-MM' 한 달 학사일정 */
export function useMonthEvents(settings: Settings, month: string) {
  const s = settings.school;
  const from = `${month}-01`;
  const to = `${month}-31`; // 나이스는 없는 날짜도 범위로 받아준다
  return useCachedRemote<SchoolEvent[]>(
    s ? `ev:${s.officeCode}-${s.schoolCode}-${s.grade}:${month}` : null,
    () => fetchSchoolEvents(s!, from, to, settings.neisKey),
    12 * HOUR,
  );
}

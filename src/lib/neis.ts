import { compactISO, fromCompact } from './date';
import type { SchoolConfig } from '../store/types';

// 나이스 교육정보 개방 포털: https://open.neis.go.kr
// 인증키 없이도 호출되지만 샘플 모드라 요청 한 번에 처음 5건만 준다.
// (pIndex를 바꿔도 같은 5건이 와서 나눠 받을 수도 없다.)
// 그래서 키가 없으면 한 번만 부르고, 일부만 받았다고 partial로 알린다.

const BASE = 'https://open.neis.go.kr/hub';
const KEYLESS_PAGE = 5;
const KEYED_PAGE = 1000;
const KEYED_MAX_PAGES = 5;

export interface SchoolInfo {
  officeCode: string;
  officeName: string;
  schoolCode: string;
  schoolName: string;
  address: string;
}

export interface Period {
  period: number;
  subject: string;
}

export interface SchoolEvent {
  date: string;
  name: string;
  /** 휴업일·공휴일 여부 */
  holiday: boolean;
}

type Row = Record<string, string | null>;

export class NeisError extends Error {}

interface PageResult {
  total: number;
  rows: Row[];
}

export function parseNeisResponse(service: string, json: unknown): PageResult {
  const body = json as Record<string, unknown>;
  // 데이터가 없으면 {"RESULT":{"CODE":"INFO-200", ...}} 형태로 온다
  const topResult = body.RESULT as { CODE: string; MESSAGE: string } | undefined;
  if (topResult) {
    if (topResult.CODE === 'INFO-200') return { total: 0, rows: [] };
    throw new NeisError(`${topResult.CODE}: ${topResult.MESSAGE}`);
  }
  const parts = body[service] as Array<Record<string, unknown>> | undefined;
  if (!parts) throw new NeisError('알 수 없는 응답 형식');
  const head = parts[0].head as Array<Record<string, unknown>>;
  const total = Number(head[0].list_total_count ?? 0);
  const result = head[1]?.RESULT as { CODE: string; MESSAGE: string } | undefined;
  if (result && result.CODE !== 'INFO-000') throw new NeisError(`${result.CODE}: ${result.MESSAGE}`);
  const rows = (parts[1]?.row as Row[] | undefined) ?? [];
  return { total, rows };
}

interface FetchResult {
  rows: Row[];
  /** 키가 없어서 전체 중 일부만 받았는지 */
  partial: boolean;
}

async function fetchAll(
  service: string,
  params: Record<string, string>,
  key: string,
  fetchFn: typeof fetch = fetch,
): Promise<FetchResult> {
  const size = key ? KEYED_PAGE : KEYLESS_PAGE;
  const maxPages = key ? KEYED_MAX_PAGES : 1;
  const rows: Row[] = [];
  let total = 0;
  for (let page = 1; page <= maxPages; page++) {
    const q = new URLSearchParams({ Type: 'json', pIndex: String(page), pSize: String(size), ...params });
    if (key) q.set('KEY', key);
    const res = await fetchFn(`${BASE}/${service}?${q}`);
    if (!res.ok) throw new NeisError(`HTTP ${res.status}`);
    const parsed = parseNeisResponse(service, await res.json());
    total = parsed.total;
    rows.push(...parsed.rows);
    if (rows.length >= total || parsed.rows.length < size) break;
  }
  return { rows, partial: rows.length < total };
}

export interface SchoolSearch {
  schools: SchoolInfo[];
  partial: boolean;
}

export async function searchSchools(name: string, key: string, fetchFn?: typeof fetch): Promise<SchoolSearch> {
  const { rows, partial } = await fetchAll(
    'schoolInfo',
    { SCHUL_NM: name, SCHUL_KND_SC_NM: '고등학교' },
    key,
    fetchFn,
  );
  const schools = rows.map((r) => ({
    officeCode: r.ATPT_OFCDC_SC_CODE ?? '',
    officeName: r.ATPT_OFCDC_SC_NM ?? '',
    schoolCode: r.SD_SCHUL_CODE ?? '',
    schoolName: r.SCHUL_NM ?? '',
    address: r.ORG_RDNMA ?? '',
  }));
  return { schools, partial };
}

/** 날짜별 시간표. 같은 교시가 중복으로 오는 경우가 있어 교시당 하나만 남긴다. */
export function rowsToTimetable(rows: Row[]): Record<string, Period[]> {
  const out: Record<string, Map<number, string>> = {};
  for (const r of rows) {
    if (!r.ALL_TI_YMD || !r.PERIO) continue;
    const date = fromCompact(r.ALL_TI_YMD);
    const subject = (r.ITRT_CNTNT ?? '').replace(/^-/, '').trim();
    if (!subject) continue;
    const map = (out[date] ??= new Map());
    if (!map.has(+r.PERIO)) map.set(+r.PERIO, subject);
  }
  return Object.fromEntries(
    Object.entries(out).map(([date, map]) => [
      date,
      [...map.entries()].sort(([a], [b]) => a - b).map(([period, subject]) => ({ period, subject })),
    ]),
  );
}

export interface TimetableResult {
  days: Record<string, Period[]>;
  partial: boolean;
}

export async function fetchTimetable(
  school: SchoolConfig,
  from: string,
  to: string,
  key: string,
  fetchFn?: typeof fetch,
): Promise<TimetableResult> {
  const { rows, partial } = await fetchAll(
    'hisTimetable',
    {
      ATPT_OFCDC_SC_CODE: school.officeCode,
      SD_SCHUL_CODE: school.schoolCode,
      GRADE: school.grade,
      CLASS_NM: school.className,
      TI_FROM_YMD: compactISO(from),
      TI_TO_YMD: compactISO(to),
    },
    key,
    fetchFn,
  );
  return { days: rowsToTimetable(rows), partial };
}

const GRADE_FLAGS = [
  'ONE_GRADE_EVENT_YN',
  'TW_GRADE_EVENT_YN',
  'THREE_GRADE_EVENT_YN',
  'FR_GRADE_EVENT_YN',
  'FIV_GRADE_EVENT_YN',
  'SIX_GRADE_EVENT_YN',
];

/**
 * 내 학년 행사만 남긴다. 어느 학년에도 Y가 없으면 전체 행사로 본다.
 * 매주 있는 토요휴업일은 달력만 어지럽혀서 뺀다.
 */
export function rowsToSchoolEvents(rows: Row[], grade: string): SchoolEvent[] {
  const myFlag = GRADE_FLAGS[Number(grade) - 1];
  const seen = new Set<string>();
  const out: SchoolEvent[] = [];
  for (const r of rows) {
    const name = (r.EVENT_NM ?? '').trim();
    if (!r.AA_YMD || !name || name === '토요휴업일') continue;
    const anyGrade = GRADE_FLAGS.some((f) => r[f] === 'Y');
    if (anyGrade && myFlag && r[myFlag] !== 'Y') continue;
    const date = fromCompact(r.AA_YMD);
    const k = `${date}|${name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ date, name, holiday: (r.SBTR_DD_SC_NM ?? '') !== '해당없음' && !!r.SBTR_DD_SC_NM });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface SchoolEventsResult {
  events: SchoolEvent[];
  partial: boolean;
}

export async function fetchSchoolEvents(
  school: SchoolConfig,
  from: string,
  to: string,
  key: string,
  fetchFn?: typeof fetch,
): Promise<SchoolEventsResult> {
  const { rows, partial } = await fetchAll(
    'SchoolSchedule',
    {
      ATPT_OFCDC_SC_CODE: school.officeCode,
      SD_SCHUL_CODE: school.schoolCode,
      AA_FROM_YMD: compactISO(from),
      AA_TO_YMD: compactISO(to),
    },
    key,
    fetchFn,
  );
  return { events: rowsToSchoolEvents(rows, school.grade), partial };
}

export interface Meal {
  /** 조식·중식·석식 */
  kind: string;
  dishes: string[];
  calories: string;
}

/** '닭곰탕&소면 (5.6.15)<br/>깍두기 (9)' → ['닭곰탕&소면', '깍두기'] (알레르기 번호는 뺀다) */
export function parseDishes(raw: string): string[] {
  return raw
    .split(/<br\s*\/?>/i)
    .map((d) =>
      d
        .replace(/\(\s*[\d.\s]+\s*\)/g, '')
        .replace(/[*#]+$/g, '')
        .trim(),
    )
    .filter(Boolean);
}

/** 날짜별 급식. 조식→중식→석식 순서. */
export function rowsToMeals(rows: Row[]): Record<string, Meal[]> {
  const out: Record<string, Array<Meal & { code: number }>> = {};
  for (const r of rows) {
    if (!r.MLSV_YMD || !r.DDISH_NM) continue;
    const date = fromCompact(r.MLSV_YMD);
    (out[date] ??= []).push({
      code: Number(r.MMEAL_SC_CODE ?? 0),
      kind: r.MMEAL_SC_NM ?? '',
      dishes: parseDishes(r.DDISH_NM),
      calories: (r.CAL_INFO ?? '').trim(),
    });
  }
  return Object.fromEntries(
    Object.entries(out).map(([date, meals]) => [
      date,
      meals.sort((a, b) => a.code - b.code).map(({ kind, dishes, calories }) => ({ kind, dishes, calories })),
    ]),
  );
}

export interface MealsResult {
  days: Record<string, Meal[]>;
  partial: boolean;
}

export async function fetchMeals(
  school: SchoolConfig,
  from: string,
  to: string,
  key: string,
  fetchFn?: typeof fetch,
): Promise<MealsResult> {
  const { rows, partial } = await fetchAll(
    'mealServiceDietInfo',
    {
      ATPT_OFCDC_SC_CODE: school.officeCode,
      SD_SCHUL_CODE: school.schoolCode,
      MLSV_FROM_YMD: compactISO(from),
      MLSV_TO_YMD: compactISO(to),
    },
    key,
    fetchFn,
  );
  return { days: rowsToMeals(rows), partial };
}

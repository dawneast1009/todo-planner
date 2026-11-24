import { compactISO, fromCompact } from './date';
import type { SchoolConfig } from '../store/types';

// 나이스 교육정보 개방 포털: https://open.neis.go.kr
// 인증키 없이도 호출되지만 한 번에 5건까지만 준다(샘플 모드).
// 그래서 키가 없으면 5건씩 페이지를 넘겨 받고, 키가 있으면 한 번에 받는다.

const BASE = 'https://open.neis.go.kr/hub';
const KEYLESS_PAGE = 5;
const KEYED_PAGE = 1000;
// 키 없이 너무 많이 부르지 않도록 상한을 둔다 (5건 × 40 = 200건)
const KEYLESS_MAX_PAGES = 40;

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

async function fetchAll(
  service: string,
  params: Record<string, string>,
  key: string,
  fetchFn: typeof fetch = fetch,
): Promise<Row[]> {
  const size = key ? KEYED_PAGE : KEYLESS_PAGE;
  const maxPages = key ? 5 : KEYLESS_MAX_PAGES;
  const rows: Row[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const q = new URLSearchParams({ Type: 'json', pIndex: String(page), pSize: String(size), ...params });
    if (key) q.set('KEY', key);
    const res = await fetchFn(`${BASE}/${service}?${q}`);
    if (!res.ok) throw new NeisError(`HTTP ${res.status}`);
    const { total, rows: pageRows } = parseNeisResponse(service, await res.json());
    rows.push(...pageRows);
    if (rows.length >= total || pageRows.length < size) break;
  }
  return rows;
}

export async function searchSchools(name: string, key: string, fetchFn?: typeof fetch): Promise<SchoolInfo[]> {
  const rows = await fetchAll(
    'schoolInfo',
    { SCHUL_NM: name, SCHUL_KND_SC_NM: '고등학교' },
    key,
    fetchFn,
  );
  return rows.map((r) => ({
    officeCode: r.ATPT_OFCDC_SC_CODE ?? '',
    officeName: r.ATPT_OFCDC_SC_NM ?? '',
    schoolCode: r.SD_SCHUL_CODE ?? '',
    schoolName: r.SCHUL_NM ?? '',
    address: r.ORG_RDNMA ?? '',
  }));
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

export async function fetchTimetable(
  school: SchoolConfig,
  from: string,
  to: string,
  key: string,
  fetchFn?: typeof fetch,
): Promise<Record<string, Period[]>> {
  const rows = await fetchAll(
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
  return rowsToTimetable(rows);
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

export async function fetchSchoolEvents(
  school: SchoolConfig,
  from: string,
  to: string,
  key: string,
  fetchFn?: typeof fetch,
): Promise<SchoolEvent[]> {
  const rows = await fetchAll(
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
  return rowsToSchoolEvents(rows, school.grade);
}

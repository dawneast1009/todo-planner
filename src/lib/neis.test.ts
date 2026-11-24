import { describe, expect, it } from 'vitest';
import { fetchTimetable, NeisError, parseNeisResponse, rowsToSchoolEvents, rowsToTimetable } from './neis';

describe('parseNeisResponse', () => {
  it('데이터 없음(INFO-200)은 빈 결과', () => {
    expect(parseNeisResponse('hisTimetable', { RESULT: { CODE: 'INFO-200', MESSAGE: '없음' } })).toEqual({
      total: 0,
      rows: [],
    });
  });

  it('오류 코드는 예외', () => {
    expect(() => parseNeisResponse('hisTimetable', { RESULT: { CODE: 'ERROR-290', MESSAGE: '키 오류' } })).toThrow(
      NeisError,
    );
  });
});

describe('rowsToTimetable', () => {
  it('날짜별·교시순으로 묶고 중복 교시는 하나만', () => {
    const rows = [
      { ALL_TI_YMD: '20261116', PERIO: '2', ITRT_CNTNT: '공통수학2' },
      { ALL_TI_YMD: '20261116', PERIO: '1', ITRT_CNTNT: '진로활동' },
      { ALL_TI_YMD: '20261116', PERIO: '1', ITRT_CNTNT: '진로활동' },
      { ALL_TI_YMD: '20261117', PERIO: '1', ITRT_CNTNT: '-국어' },
    ];
    expect(rowsToTimetable(rows)).toEqual({
      '2026-11-16': [
        { period: 1, subject: '진로활동' },
        { period: 2, subject: '공통수학2' },
      ],
      '2026-11-17': [{ period: 1, subject: '국어' }],
    });
  });
});

describe('rowsToSchoolEvents', () => {
  const base = {
    ONE_GRADE_EVENT_YN: 'N',
    TW_GRADE_EVENT_YN: 'N',
    THREE_GRADE_EVENT_YN: 'N',
    FR_GRADE_EVENT_YN: '*',
    FIV_GRADE_EVENT_YN: '*',
    SIX_GRADE_EVENT_YN: '*',
    SBTR_DD_SC_NM: '해당없음',
  };
  it('내 학년 행사와 전체 행사만, 토요휴업일은 뺀다', () => {
    const rows = [
      { ...base, AA_YMD: '20261201', EVENT_NM: '3학년 행사', THREE_GRADE_EVENT_YN: 'Y' },
      { ...base, AA_YMD: '20261202', EVENT_NM: '1학년 행사', ONE_GRADE_EVENT_YN: 'Y' },
      { ...base, AA_YMD: '20261203', EVENT_NM: '개교기념일', SBTR_DD_SC_NM: '휴업일' },
      { ...base, AA_YMD: '20261205', EVENT_NM: '토요휴업일', SBTR_DD_SC_NM: '휴업일' },
    ];
    expect(rowsToSchoolEvents(rows, '1')).toEqual([
      { date: '2026-12-02', name: '1학년 행사', holiday: false },
      { date: '2026-12-03', name: '개교기념일', holiday: true },
    ]);
  });
});

describe('fetchAll paging', () => {
  it('키가 없으면 5건씩 끝까지 넘겨 받는다', async () => {
    const all = Array.from({ length: 12 }, (_, i) => ({
      ALL_TI_YMD: '20261116',
      PERIO: String(i + 1),
      ITRT_CNTNT: `과목${i + 1}`,
    }));
    const urls: string[] = [];
    const fakeFetch = (async (url: string) => {
      urls.push(url);
      const u = new URL(url);
      const page = Number(u.searchParams.get('pIndex'));
      const size = Number(u.searchParams.get('pSize'));
      const rows = all.slice((page - 1) * size, page * size);
      return new Response(
        JSON.stringify({
          hisTimetable: [
            { head: [{ list_total_count: all.length }, { RESULT: { CODE: 'INFO-000', MESSAGE: '' } }] },
            { row: rows },
          ],
        }),
      );
    }) as typeof fetch;
    const school = { officeCode: 'B10', schoolCode: '1', schoolName: 'x', grade: '1', className: '1' };
    const tt = await fetchTimetable(school, '2026-11-16', '2026-11-20', '', fakeFetch);
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => !u.includes('KEY='))).toBe(true);
    expect(tt['2026-11-16']).toHaveLength(12);
  });
});

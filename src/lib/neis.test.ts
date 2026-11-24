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

describe('fetchAll', () => {
  const all = Array.from({ length: 7 }, (_, i) => ({
    ALL_TI_YMD: '20261116',
    PERIO: String(i + 1),
    ITRT_CNTNT: `과목${i + 1}`,
  }));
  const school = { officeCode: 'B10', schoolCode: '1', schoolName: 'x', grade: '1', className: '1' };

  // 실제 나이스처럼: 키가 없으면 pIndex와 상관없이 처음 5건만 준다
  function fakeNeis(urls: string[]) {
    return (async (url: string) => {
      urls.push(url);
      const u = new URL(url);
      const hasKey = u.searchParams.has('KEY');
      const page = Number(u.searchParams.get('pIndex'));
      const size = hasKey ? Number(u.searchParams.get('pSize')) : 5;
      const rows = hasKey ? all.slice((page - 1) * size, page * size) : all.slice(0, 5);
      return new Response(
        JSON.stringify({
          hisTimetable: [
            { head: [{ list_total_count: all.length }, { RESULT: { CODE: 'INFO-000', MESSAGE: '' } }] },
            { row: rows },
          ],
        }),
      );
    }) as typeof fetch;
  }

  it('키가 없으면 한 번만 부르고 일부라고 알린다', async () => {
    const urls: string[] = [];
    const tt = await fetchTimetable(school, '2026-11-16', '2026-11-16', '', fakeNeis(urls));
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain('KEY=');
    expect(tt.partial).toBe(true);
    expect(tt.days['2026-11-16']).toHaveLength(5);
  });

  it('키가 있으면 전부 받는다', async () => {
    const urls: string[] = [];
    const tt = await fetchTimetable(school, '2026-11-16', '2026-11-20', 'test-key', fakeNeis(urls));
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('KEY=test-key');
    expect(tt.partial).toBe(false);
    expect(tt.days['2026-11-16']).toHaveLength(7);
  });
});

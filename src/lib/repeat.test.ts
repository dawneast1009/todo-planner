import { describe, expect, it } from 'vitest';
import type { Item } from '../store/types';
import { expandItems, nextOccurrences, occurrences, repeatLabel } from './repeat';

const series = (over: Partial<Item>): Item => ({
  id: 's',
  title: '학원',
  memo: '',
  date: '2026-11-23',
  time: '16:00',
  kind: 'event',
  done: false,
  doneOn: null,
  important: false,
  groupId: null,
  createdAt: 1,
  updatedAt: 1,
  repeat: { freq: 'weekly', days: [1, 3, 5] },
  ...over,
});

describe('occurrences', () => {
  it('매주 월수금', () => {
    expect(occurrences({ freq: 'weekly', days: [1, 3, 5] }, '2026-11-23', '2026-11-23', '2026-11-30')).toEqual([
      '2026-11-23',
      '2026-11-25',
      '2026-11-27',
      '2026-11-30',
    ]);
  });

  it('시작일 전은 없다', () => {
    expect(occurrences({ freq: 'daily' }, '2026-11-25', '2026-11-23', '2026-11-26')).toEqual(['2026-11-25', '2026-11-26']);
  });

  it('매월 31일은 31일이 없는 달을 건너뛴다', () => {
    expect(occurrences({ freq: 'monthly', day: 31 }, '2026-11-01', '2026-11-01', '2027-01-31')).toEqual([
      '2026-12-31',
      '2027-01-31',
    ]);
  });
});

describe('expandItems', () => {
  it('날짜별로 펼치고 체크·건너뛴 날을 반영한다', () => {
    const s = series({ doneDates: ['2026-11-23'], skipDates: ['2026-11-25'] });
    const plain = series({ id: 'p', repeat: null, date: '2026-11-24' });
    const out = expandItems([s, plain], '2026-11-23', '2026-11-27');
    expect(out.map((i) => [i.id, i.date, i.done])).toEqual([
      ['s@2026-11-23', '2026-11-23', true],
      ['s@2026-11-27', '2026-11-27', false],
      ['p', '2026-11-24', false],
    ]);
    expect(out[0].seriesId).toBe('s');
  });
});

describe('nextOccurrences', () => {
  it('반복마다 아직 안 한 다음 날짜 하나만', () => {
    const s = series({ doneDates: ['2026-11-25'] });
    expect(nextOccurrences([s], '2026-11-25').map((i) => i.date)).toEqual(['2026-11-27']);
  });
});

describe('repeatLabel', () => {
  it('사람이 읽는 말로', () => {
    expect(repeatLabel({ freq: 'weekly', days: [1, 3, 5] })).toBe('매주 월수금');
    expect(repeatLabel({ freq: 'weekly', days: [1, 2, 3, 4, 5] })).toBe('평일');
    expect(repeatLabel({ freq: 'weekly', days: [0, 6] })).toBe('주말');
    expect(repeatLabel({ freq: 'monthly', day: 25 })).toBe('매월 25일');
    expect(repeatLabel({ freq: 'daily' })).toBe('매일');
  });
});

describe('매년', () => {
  it('양력 매년', () => {
    // 한 번에 400일까지만 본다 (달력은 한 달씩 펼친다)
    expect(occurrences({ freq: 'yearly', month: 12, day: 25 }, '2026-12-01', '2026-12-01', '2027-12-31')).toEqual([
      '2026-12-25',
      '2027-12-25',
    ]);
  });

  it('양력 2월 29일은 윤년이 아니면 2월 28일', () => {
    expect(occurrences({ freq: 'yearly', month: 2, day: 29 }, '2027-02-01', '2027-02-01', '2028-03-01')).toEqual([
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('음력 매년: 해마다 양력 날짜가 바뀐다 (추석)', () => {
    const rule = { freq: 'yearly' as const, month: 8, day: 15, lunar: true };
    expect(occurrences(rule, '2026-09-01', '2026-09-01', '2027-09-30')).toEqual(['2026-09-25', '2027-09-15']);
    expect(repeatLabel(rule)).toBe('매년 음력 8월 15일');
  });
});

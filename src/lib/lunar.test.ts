import { describe, expect, it } from 'vitest';
import { isLunarDay, lunarLabel, toLunar } from './lunar';

describe('toLunar (한국 음력)', () => {
  it('설날·추석', () => {
    expect(toLunar('2026-02-17')).toEqual({ month: 1, day: 1, leap: false });
    expect(toLunar('2026-09-25')).toEqual({ month: 8, day: 15, leap: false });
    expect(toLunar('2027-02-07')).toEqual({ month: 1, day: 1, leap: false });
  });

  it('윤달', () => {
    expect(toLunar('2025-07-25')).toEqual({ month: 6, day: 1, leap: true });
    expect(lunarLabel('2025-07-25')).toBe('음력 윤6월 1일');
  });
});

describe('isLunarDay', () => {
  it('매년 음력 날짜 찾기', () => {
    expect(isLunarDay('2026-09-25', 8, 15)).toBe(true);
    expect(isLunarDay('2026-09-24', 8, 15)).toBe(false);
  });

  it('윤달은 치지 않는다 (2025년 6월 1일은 평달만)', () => {
    expect(isLunarDay('2025-06-25', 6, 1)).toBe(true);
    expect(isLunarDay('2025-07-25', 6, 1)).toBe(false);
  });

  it('30일이 없는 달은 29일로', () => {
    // 2026년 음력 2월은 29일(양력 4/16)까지만 있다
    expect(toLunar('2026-04-16')).toEqual({ month: 2, day: 29, leap: false });
    expect(toLunar('2026-04-17')).toMatchObject({ month: 3, day: 1 });
    expect(isLunarDay('2026-04-16', 2, 30)).toBe(true);
    expect(isLunarDay('2026-04-15', 2, 30)).toBe(false);
    // 30일이 있는 달에서는 30일에만
    expect(toLunar('2027-02-06')).toEqual({ month: 12, day: 30, leap: false });
    expect(isLunarDay('2027-02-05', 12, 30)).toBe(false);
    expect(isLunarDay('2027-02-06', 12, 30)).toBe(true);
  });
});

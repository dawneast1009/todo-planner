import { describe, expect, it } from 'vitest';
import { relativeLabel, shortLabel } from './date';

describe('날짜 표시', () => {
  it('올해가 아니면 연도를 붙인다', () => {
    expect(shortLabel('2027-08-13', '2026-11-24')).toBe('2027년 8/13 (금)');
    expect(shortLabel('2026-12-25', '2026-11-24')).toBe('12/25 (금)');
    expect(shortLabel('2027-08-13')).toBe('8/13 (금)');
    expect(relativeLabel('2027-08-13', '2026-11-24')).toBe('2027년 8/13 (금)');
    expect(relativeLabel('2026-11-25', '2026-11-24')).toBe('내일');
  });
});

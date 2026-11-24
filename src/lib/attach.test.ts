import { describe, expect, it } from 'vitest';
import { AttachError, checkFile, formatSize, joinChunks, splitChunks } from './attach';

describe('조각 나누기', () => {
  it('나눴다 합치면 원래대로', () => {
    const bytes = new Uint8Array(2_000_001).map((_, i) => i % 251);
    const parts = splitChunks(bytes, 750_000);
    expect(parts.map((p) => p.length)).toEqual([750_000, 750_000, 500_001]);
    expect(joinChunks(parts)).toEqual(bytes);
  });

  it('빈 파일도 한 조각', () => {
    expect(splitChunks(new Uint8Array(0))).toHaveLength(1);
  });

  it('5MB는 7조각 (한 조각이 Firestore 1MiB 제한 아래)', () => {
    expect(splitChunks(new Uint8Array(5 * 1024 * 1024))).toHaveLength(7);
  });
});

describe('checkFile', () => {
  it('사진과 PDF만', () => {
    expect(checkFile({ type: 'image/jpeg', name: 'a.jpg', size: 1 })).toBe('image');
    expect(checkFile({ type: 'application/pdf', name: 'a.pdf', size: 1 })).toBe('pdf');
    // 일부 폰은 PDF 형식을 비워서 준다
    expect(checkFile({ type: '', name: '안내문.PDF', size: 1 })).toBe('pdf');
    expect(() => checkFile({ type: 'application/x-hwp', name: '과제.hwp', size: 1 })).toThrow(AttachError);
  });
});

describe('formatSize', () => {
  it('읽기 쉽게', () => {
    expect(formatSize(500)).toBe('500B');
    expect(formatSize(300 * 1024)).toBe('300KB');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5MB');
  });
});

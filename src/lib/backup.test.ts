import { describe, expect, it } from 'vitest';
import { BackupError, backupFileContent, parseBackup } from './backup';
import type { Group, Item } from '../store/types';

const group: Group = { id: 'g1', name: '수행평가', createdAt: 1 };
const item: Item = {
  id: 'i1',
  title: '영어 발표',
  memo: '대본 외우기',
  date: '2026-12-05',
  time: '09:00',
  kind: 'event',
  done: false,
  doneOn: null,
  important: true,
  groupId: 'g1',
  createdAt: 2,
  updatedAt: 3,
};

describe('parseBackup', () => {
  it('내보낸 파일을 그대로 되읽는다', () => {
    expect(parseBackup(backupFileContent([item], [group]))).toEqual({ items: [item], groups: [group] });
  });

  it('JSON이 아니거나 백업 형식이 아니면 거부', () => {
    expect(() => parseBackup('hello')).toThrow(BackupError);
    expect(() => parseBackup('{"foo": 1}')).toThrow(BackupError);
    expect(() => parseBackup('[]')).toThrow(BackupError);
  });

  it('이상한 필드는 안전한 값으로 바꾼다', () => {
    const text = JSON.stringify({
      items: [
        { id: 'a', title: '날짜 이상', date: '12월 5일', time: '9시', kind: 'event', done: 'yes', groupId: 'nope' },
        { id: '', title: 'id 없음' },
        { id: 'b' },
        null,
      ],
      groups: [{ id: 'g', name: '' }],
    });
    const b = parseBackup(text);
    expect(b.groups).toEqual([]);
    expect(b.items).toHaveLength(1);
    expect(b.items[0]).toMatchObject({
      id: 'a',
      date: null,
      time: null,
      kind: 'todo',
      done: false,
      groupId: null,
      memo: '',
    });
  });
});

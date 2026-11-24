import type { Group, Item } from '../store/types';

export interface Backup {
  items: Item[];
  groups: Group[];
}

export class BackupError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);

/**
 * 내보낸 백업 JSON을 읽는다. 형식이 이상한 필드는 기본값으로 바꾸고,
 * 아예 백업 파일이 아니면 BackupError를 던진다.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('JSON 파일이 아니에요.');
  }
  const obj = raw as { items?: unknown; groups?: unknown };
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) {
    throw new BackupError('이 앱에서 내보낸 백업 파일이 아니에요.');
  }

  const now = Date.now();
  const groups: Group[] = (Array.isArray(obj.groups) ? obj.groups : [])
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .filter((g) => str(g.id) && str(g.name))
    .map((g) => ({ id: str(g.id), name: str(g.name), createdAt: num(g.createdAt, now) }));
  const groupIds = new Set(groups.map((g) => g.id));

  const items: Item[] = obj.items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .filter((i) => str(i.id) && str(i.title))
    .map((i) => {
      const date = dateOrNull(i.date);
      const done = i.done === true;
      const groupId = str(i.groupId);
      return {
        id: str(i.id),
        title: str(i.title),
        memo: str(i.memo),
        date,
        time: date && typeof i.time === 'string' && TIME_RE.test(i.time) ? i.time : null,
        kind: date && i.kind === 'event' ? 'event' : 'todo',
        done,
        doneOn: done ? dateOrNull(i.doneOn) : null,
        important: i.important === true,
        groupId: groupIds.has(groupId) ? groupId : null,
        createdAt: num(i.createdAt, now),
        updatedAt: num(i.updatedAt, now),
      } satisfies Item;
    });

  return { items, groups };
}

export function backupFileContent(items: Item[], groups: Group[]): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), items, groups }, null, 2);
}

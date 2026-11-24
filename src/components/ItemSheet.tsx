import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { addDays } from '../lib/date';
import type { Item, ItemKind } from '../store/types';

const NEW_GROUP = '__new__';

/** 항목을 눌렀을 때 뜨는 편집 창. 닫으면 저장된다. */
export function ItemSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const { store, groups, today, ensureGroup } = useApp();
  const [title, setTitle] = useState(item.title);
  const [memo, setMemo] = useState(item.memo);
  const [date, setDate] = useState(item.date ?? '');
  const [time, setTime] = useState(item.time ?? '');
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [groupId, setGroupId] = useState(item.groupId ?? '');
  const [important, setImportant] = useState(item.important);

  const save = () => {
    const next: Item = {
      ...item,
      title: title.trim() || item.title,
      memo,
      date: date || null,
      time: date && time ? time : null,
      // 날짜 없는 일정은 의미가 없어서 할 일로 둔다
      kind: date ? kind : 'todo',
      groupId: groupId || null,
      important,
    };
    const changed = (Object.keys(next) as Array<keyof Item>).some((k) => next[k] !== item[k]);
    if (changed) store.putItem({ ...next, updatedAt: Date.now() });
    onClose();
  };

  const remove = () => {
    if (confirm(`'${item.title}' 삭제할까요?`)) {
      store.removeItem(item.id);
      onClose();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="sheet-backdrop" onClick={save}>
      <div className="sheet" role="dialog" aria-label="항목 편집" onClick={(e) => e.stopPropagation()}>
        <input className="sheet-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="제목" />
        <textarea
          className="sheet-memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={4}
        />

        <div className="field-row">
          <label>
            날짜
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            시간
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
          </label>
        </div>
        <div className="quick-dates">
          <button type="button" onClick={() => setDate(today)}>
            오늘
          </button>
          <button type="button" onClick={() => setDate(addDays(today, 1))}>
            내일
          </button>
          <button
            type="button"
            onClick={() => {
              setDate('');
              setTime('');
            }}
          >
            언젠가
          </button>
        </div>

        {date && (
          <div className="segmented" role="radiogroup" aria-label="종류">
            <button type="button" className={kind === 'todo' ? 'on' : ''} onClick={() => setKind('todo')}>
              할 일 <small>못 하면 다음 날로</small>
            </button>
            <button type="button" className={kind === 'event' ? 'on' : ''} onClick={() => setKind('event')}>
              일정 <small>그 날만</small>
            </button>
          </div>
        )}

        <label className="field">
          그룹
          <select
            value={groupId}
            onChange={(e) => {
              if (e.target.value !== NEW_GROUP) return setGroupId(e.target.value);
              const name = prompt('새 그룹 이름 (예: 수행평가)')?.trim().replace(/^#/, '');
              if (name) setGroupId(ensureGroup(name));
            }}
          >
            <option value="">없음</option>
            {groups
              .slice()
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            <option value={NEW_GROUP}>+ 새 그룹 만들기…</option>
          </select>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          <span>중요 (오늘 화면에 D-day 표시)</span>
        </label>
        {important && !date && <p className="hint">날짜가 있어야 D-day가 떠요.</p>}

        <div className="sheet-actions">
          <button type="button" className="danger" onClick={remove}>
            삭제
          </button>
          <button type="button" className="primary" onClick={save}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

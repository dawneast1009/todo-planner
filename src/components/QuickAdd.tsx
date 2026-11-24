import { useRef, useState } from 'react';
import { useApp, type AddDefaults } from '../context';
import { relativeLabel, timeLabel } from '../lib/date';
import { parseQuickInput } from '../lib/parse';

interface Props extends AddDefaults {
  placeholder?: string;
}

/** 입력창 하나. 한 줄 치고 Enter면 저장. 해석된 날짜·시간·그룹은 아래에 미리 보여준다. */
export function QuickAdd({ date: defaultDate, groupId: defaultGroupId, placeholder }: Props) {
  const { today, groups, groupName, addFromText } = useApp();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();
  const parsed = trimmed ? parseQuickInput(trimmed, today) : null;
  const date = parsed?.date ?? defaultDate ?? null;
  const existingGroup = parsed?.group
    ? groups.find((g) => g.name.toLowerCase() === parsed.group!.toLowerCase())
    : undefined;
  const group = parsed?.group
    ? { name: existingGroup?.name ?? parsed.group, isNew: !existingGroup }
    : defaultGroupId
      ? { name: groupName(defaultGroupId) ?? '', isNew: false }
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    addFromText(trimmed, { date: defaultDate, groupId: defaultGroupId });
    setText('');
    inputRef.current?.focus();
  };

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-add-row">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? '예: 내일 3시 치과, 금요일까지 과제 #수행평가'}
          enterKeyHint="done"
          autoComplete="off"
          aria-label="새 항목"
        />
        <button type="submit" className="add-btn" disabled={!trimmed} aria-label="추가">
          +
        </button>
      </div>
      {parsed && (
        <div className="chips" aria-live="polite">
          <span className={`chip ${date ? 'chip-date' : 'chip-someday'}`}>{date ? relativeLabel(date, today) : '언젠가'}</span>
          {parsed.time && <span className="chip chip-time">{timeLabel(parsed.time)}</span>}
          {group && (
            <span className="chip chip-group">
              #{group.name}
              {group.isNew && ' (새 그룹)'}
            </span>
          )}
          <span className="chip-title">{parsed.title}</span>
        </div>
      )}
    </form>
  );
}

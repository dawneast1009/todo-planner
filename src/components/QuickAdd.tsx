import { useRef, useState } from 'react';
import { useApp, type AddDefaults } from '../context';
import { relativeLabel, timeLabel } from '../lib/date';
import { parseQuickInput } from '../lib/parse';
import { repeatLabel } from '../lib/repeat';

interface Props extends AddDefaults {
  placeholder?: string;
}

/**
 * 입력창 하나. 한 줄 치고 Enter면 저장. 해석된 날짜·시간은 아래에 미리 보여준다.
 * 입력창을 누르면 그룹 칩이 나와서 그룹을 바로 고를 수 있다 (안 골라도 된다).
 */
export function QuickAdd({ date: defaultDate, groupId: defaultGroupId = null, placeholder }: Props) {
  const { today, groups, ensureGroup, addFromText } = useApp();
  const [text, setText] = useState('');
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(defaultGroupId);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 그룹 필터가 바뀌면 고른 그룹도 따라간다
  const [lastDefault, setLastDefault] = useState(defaultGroupId);
  if (lastDefault !== defaultGroupId) {
    setLastDefault(defaultGroupId);
    setPickedGroupId(defaultGroupId);
  }

  const trimmed = text.trim();
  const parsed = trimmed ? parseQuickInput(trimmed, today) : null;
  const date = parsed?.date ?? defaultDate ?? null;
  const typedGroup = parsed?.group
    ? (groups.find((g) => g.name.toLowerCase() === parsed.group!.toLowerCase()) ?? null)
    : null;
  const sortedGroups = groups.slice().sort((a, b) => a.createdAt - b.createdAt);
  const noneOn = !parsed?.group && !pickedGroupId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    addFromText(trimmed, { date: defaultDate, groupId: pickedGroupId });
    setText('');
    setPickedGroupId(defaultGroupId);
    inputRef.current?.focus();
  };

  const newGroup = () => {
    const name = prompt('새 그룹 이름 (예: 수행평가)')?.trim().replace(/^#/, '');
    if (name) setPickedGroupId(ensureGroup(name));
    inputRef.current?.focus();
  };

  return (
    <form
      className="quick-add"
      onSubmit={submit}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="quick-add-row">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? '할 일 적기 · 예: 내일 3시 치과'}
          enterKeyHint="done"
          autoComplete="off"
          aria-label="새 항목"
        />
        <button type="submit" className="add-btn" disabled={!trimmed} aria-label="추가">
          +
        </button>
      </div>

      {/* 입력 중에만 뜨는 작은 창. 화면 위에 겹쳐 떠서, 닫혀도 아래 내용이 움직이지 않는다
          (움직이면 아래 항목을 누를 때 엉뚱한 곳이 눌린다). */}
      {focused && (
        <div className="quick-pop" onPointerDown={(e) => e.preventDefault()}>
          {parsed && (
            <div className="chips" aria-live="polite">
              {parsed.repeat && <span className="chip chip-date">↻ {repeatLabel(parsed.repeat)}</span>}
              <span className={`chip ${date ? 'chip-date' : 'chip-someday'}`}>
                {date ? `${parsed.repeat ? '처음 ' : ''}${relativeLabel(date, today)}` : '언젠가'}
              </span>
              {parsed.time && <span className="chip chip-time">{timeLabel(parsed.time)}</span>}
              <span className="chip-title">{parsed.title}</span>
            </div>
          )}
          {/* 칩을 눌러도 입력창 포커스(키보드)가 유지되게 pointerdown 기본 동작을 막는다 */}
          <div className="group-picker" role="radiogroup" aria-label="그룹">
          <span className="picker-label">그룹</span>
          <button
            type="button"
            role="radio"
            aria-checked={noneOn}
            className={noneOn ? 'on' : ''}
            onClick={() => setPickedGroupId(null)}
          >
            없음
          </button>
          {sortedGroups.map((g) => {
            const on = parsed?.group ? typedGroup?.id === g.id : pickedGroupId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? 'on' : ''}
                onClick={() => setPickedGroupId(g.id)}
              >
                #{g.name}
              </button>
            );
          })}
          {parsed?.group && !typedGroup && (
            <span className="picker-new on" aria-label={`새 그룹 ${parsed.group}`}>
              #{parsed.group} (새 그룹)
            </span>
          )}
            <button type="button" className="picker-add" onClick={newGroup}>
              + 새 그룹
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

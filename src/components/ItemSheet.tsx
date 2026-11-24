import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { addDays, shortLabel } from '../lib/date';
import type { Item, ItemKind, RepeatRule } from '../store/types';

const NEW_GROUP = '__new__';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// 월요일부터 보여준다
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Freq = 'none' | RepeatRule['freq'];

/**
 * 항목을 눌렀을 때 뜨는 편집 창. 닫으면 저장된다.
 * 반복 항목의 하루치를 눌러서 열었으면 occurrence에 그 날짜가 온다 ('이 날만 빼기' 가능).
 */
export function ItemSheet({ item, occurrence, onClose }: { item: Item; occurrence: string | null; onClose: () => void }) {
  const { store, groups, today, ensureGroup, deleteItem, skipOccurrence } = useApp();
  const [title, setTitle] = useState(item.title);
  const [memo, setMemo] = useState(item.memo);
  const [date, setDate] = useState(item.date ?? '');
  const [time, setTime] = useState(item.time ?? '');
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [groupId, setGroupId] = useState(item.groupId ?? '');
  const [important, setImportant] = useState(item.important);
  const [freq, setFreq] = useState<Freq>(item.repeat?.freq ?? 'none');
  const [weekDays, setWeekDays] = useState<number[]>(
    item.repeat?.freq === 'weekly' ? item.repeat.days : [new Date().getDay()],
  );
  const [monthDay, setMonthDay] = useState(item.repeat?.freq === 'monthly' ? item.repeat.day : new Date().getDate());

  const buildRepeat = (): RepeatRule | null => {
    if (freq === 'daily') return { freq: 'daily' };
    if (freq === 'weekly') return weekDays.length ? { freq: 'weekly', days: [...weekDays].sort() } : null;
    if (freq === 'monthly') return { freq: 'monthly', day: monthDay };
    return null;
  };

  const save = () => {
    const repeat = buildRepeat();
    // 반복인데 날짜가 없으면 오늘부터
    const start = date || (repeat ? today : '');
    const next: Item = {
      ...item,
      title: title.trim() || item.title,
      memo,
      date: start || null,
      time: start && time ? time : null,
      // 날짜 없는 일정은 의미가 없어서 할 일로 둔다
      kind: start ? kind : 'todo',
      groupId: groupId || null,
      important,
      repeat,
    };
    if (JSON.stringify(next) !== JSON.stringify(item)) store.putItem({ ...next, updatedAt: Date.now() });
    onClose();
  };

  // 확인 창 대신 아래에 '되돌리기'가 뜬다
  const remove = () => {
    deleteItem(item);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isRepeat = freq !== 'none';

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
            {isRepeat ? '시작 날짜' : '날짜'}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            시간
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date && !isRepeat} />
          </label>
        </div>
        {!isRepeat && (
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
        )}

        <label className="field">
          반복
          <select value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
            <option value="none">안 함</option>
            <option value="daily">매일</option>
            <option value="weekly">매주 (요일 고르기)</option>
            <option value="monthly">매월</option>
          </select>
        </label>
        {freq === 'weekly' && (
          <div className="weekday-picker" role="group" aria-label="반복 요일">
            {WEEK_ORDER.map((d) => {
              const on = weekDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  className={on ? 'on' : ''}
                  onClick={() => setWeekDays(on ? weekDays.filter((x) => x !== d) : [...weekDays, d])}
                >
                  {WEEKDAYS[d]}
                </button>
              );
            })}
          </div>
        )}
        {freq === 'monthly' && (
          <label className="field">
            매월 며칠
            <select value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </label>
        )}

        {(date || isRepeat) && (
          <div className="segmented" role="radiogroup" aria-label="종류">
            <button type="button" className={kind === 'todo' ? 'on' : ''} onClick={() => setKind('todo')}>
              할 일 <small>{isRepeat ? '체크하는 것' : '못 하면 다음 날로'}</small>
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
        {important && !date && !isRepeat && <p className="hint">날짜가 있어야 D-day가 떠요.</p>}

        <div className="sheet-actions">
          <div className="btn-row">
            {occurrence && item.repeat && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  skipOccurrence(item, occurrence);
                  onClose();
                }}
              >
                {shortLabel(occurrence)}만 빼기
              </button>
            )}
            <button type="button" className="danger" onClick={remove}>
              {item.repeat ? '반복 전체 삭제' : '삭제'}
            </button>
          </div>
          <button type="button" className="primary" onClick={save}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

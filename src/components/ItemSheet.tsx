import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { addDays, shortLabel } from '../lib/date';
import type { Attachment, Item, ItemKind, RepeatRule } from '../store/types';
import { Attachments } from './Attachments';
import { extractLinks } from '../lib/links';
import { lunarSupported, toLunar } from '../lib/lunar';
import { nextOccurrence } from '../lib/repeat';

const NEW_GROUP = '__new__';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// 월요일부터 보여준다
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// 편집 창에서는 매년을 양력·음력 두 가지로 나눠 고른다
type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'yearly-lunar';

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
  const [freq, setFreq] = useState<Freq>(
    item.repeat?.freq === 'yearly' && item.repeat.lunar ? 'yearly-lunar' : (item.repeat?.freq ?? 'none'),
  );
  const [weekDays, setWeekDays] = useState<number[]>(
    item.repeat?.freq === 'weekly' ? item.repeat.days : [new Date().getDay()],
  );
  const [monthDay, setMonthDay] = useState(item.repeat?.freq === 'monthly' ? item.repeat.day : new Date().getDate());
  // 매년: 처음엔 항목 날짜(없으면 오늘)의 양력/음력 월·일
  const baseIso = item.date ?? today;
  const baseLunar = toLunar(baseIso);
  const [yearSolar, setYearSolar] = useState(() =>
    item.repeat?.freq === 'yearly' && !item.repeat.lunar
      ? { month: item.repeat.month, day: item.repeat.day }
      : { month: Number(baseIso.slice(5, 7)), day: Number(baseIso.slice(8, 10)) },
  );
  const [yearLunar, setYearLunar] = useState(() =>
    item.repeat?.freq === 'yearly' && item.repeat.lunar
      ? { month: item.repeat.month, day: item.repeat.day }
      : { month: baseLunar?.month ?? 1, day: baseLunar?.day ?? 1 },
  );
  const [attachments, setAttachments] = useState<Attachment[]>(item.attachments ?? []);

  const buildRepeat = (): RepeatRule | null => {
    if (freq === 'daily') return { freq: 'daily' };
    if (freq === 'weekly') return weekDays.length ? { freq: 'weekly', days: [...weekDays].sort() } : null;
    if (freq === 'monthly') return { freq: 'monthly', day: monthDay };
    if (freq === 'yearly') return { freq: 'yearly', ...yearSolar };
    if (freq === 'yearly-lunar') return { freq: 'yearly', ...yearLunar, lunar: true };
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
      attachments,
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
        <MemoLinks memo={memo} />
        <Attachments attachments={attachments} onChange={setAttachments} />

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
            <option value="yearly">매년 (양력)</option>
            {lunarSupported() && <option value="yearly-lunar">매년 (음력) · 생신·제사</option>}
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
        {(freq === 'yearly' || freq === 'yearly-lunar') && (
          <YearlyPicker
            value={freq === 'yearly' ? yearSolar : yearLunar}
            lunar={freq === 'yearly-lunar'}
            onChange={freq === 'yearly' ? setYearSolar : setYearLunar}
            today={today}
          />
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

/** 메모에 적은 주소를 누를 수 있는 링크로 보여준다 (메모 입력칸 안에서는 링크를 누를 수 없어서) */
function MemoLinks({ memo }: { memo: string }) {
  const links = extractLinks(memo);
  if (links.length === 0) return null;
  return (
    <ul className="memo-links" aria-label="메모 속 링크">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} target="_blank" rel="noopener noreferrer">
            🔗 {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** 매년 반복의 월·일 고르기. 다음 날짜(음력이면 양력으로 바꾼 날짜)를 같이 보여준다. */
function YearlyPicker({
  value,
  lunar,
  onChange,
  today,
}: {
  value: { month: number; day: number };
  lunar: boolean;
  onChange: (v: { month: number; day: number }) => void;
  today: string;
}) {
  const next = nextOccurrence({ freq: 'yearly', ...value, lunar }, today);
  const maxDay = lunar ? 30 : new Date(2024, value.month, 0).getDate();
  return (
    <>
      <div className="field-row">
        <label>
          {lunar ? '음력 월' : '월'}
          <select
            value={value.month}
            onChange={(e) => {
              const month = Number(e.target.value);
              // 그 달에 없는 날이 되지 않게 맞춘다 (예: 1월 31일 → 2월이면 29일)
              const max = lunar ? 30 : new Date(2024, month, 0).getDate();
              onChange({ month, day: Math.min(value.day, max) });
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </label>
        <label>
          {lunar ? '음력 일' : '일'}
          <select
            value={Math.min(value.day, maxDay)}
            onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}
          >
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
        </label>
      </div>
      {next && (
        <p className="hint">
          다음: {shortLabel(next)}
          {lunar && ` (양력 ${Number(next.slice(0, 4))}년 ${Number(next.slice(5, 7))}월 ${Number(next.slice(8, 10))}일)`}
        </p>
      )}
    </>
  );
}

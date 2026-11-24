import { useState } from 'react';
import { useApp } from '../context';
import { ItemList } from './ItemRow';
import { QuickAdd } from './QuickAdd';
import { PartialHint, SchoolEvents } from './School';
import { makeDate, shortLabel, toISO } from '../lib/date';
import { lunarLabel } from '../lib/lunar';
import { expandItems } from '../lib/repeat';
import { itemsOnDate } from '../lib/views';
import { useMonthEvents } from '../school';
import type { Item } from '../store/types';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return toISO(new Date(y, m - 1 + n, 1)).slice(0, 7);
}

interface Props {
  /** 그룹으로 걸러진 항목 */
  items: Item[];
  groupId: string | null;
  /** 학사일정을 보여줄지 (그룹으로 거를 때는 숨김) */
  showSchool: boolean;
}

/** 월 달력. 날짜를 누르면 아래에 그 날 항목·학사일정·시간표가 나온다. */
export function MonthCalendar({ items, groupId, showSchool }: Props) {
  const { today, settings } = useApp();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const events = useMonthEvents(settings, month);
  const selectedEvents = useMonthEvents(settings, selected.slice(0, 7));

  const [y, m] = month.split('-').map(Number);
  const first = makeDate(y, m, 1)!;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: Array<string | null> = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(makeDate(y, m, i + 1)!)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // 반복 항목은 이 달 날짜로 펼쳐서 보여준다
  const monthItems = expandItems(items, `${month}-01`, `${month}-${String(daysInMonth).padStart(2, '0')}`);
  const dayItems = itemsOnDate(expandItems(items, selected, selected), selected);
  const dayEvents = showSchool ? (selectedEvents.data?.events.filter((e) => e.date === selected) ?? []) : [];

  return (
    <section className="month" aria-label="달력">
      <div className="cal-head">
        <button className="ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
          ‹
        </button>
        <h2>
          {y}년 {m}월
        </h2>
        <button className="ghost" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="다음 달">
          ›
        </button>
        {(month !== today.slice(0, 7) || selected !== today) && (
          <button
            className="ghost small"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSelected(today);
            }}
          >
            오늘
          </button>
        )}
      </div>

      <div className="calendar" role="grid" aria-label={`${y}년 ${m}월`}>
        {DOW.map((d, i) => (
          <div key={d} className={`cal-dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} className="cal-cell empty" />;
          const mine = itemsOnDate(monthItems, iso);
          const school = showSchool ? (events.data?.events.filter((e) => e.date === iso) ?? []) : [];
          const holiday = school.some((e) => e.holiday);
          const labels = [
            ...school.map((e) => ({ key: `s${e.name}`, text: e.name, cls: 'lbl-school' })),
            ...mine.map((it) => ({ key: it.id, text: it.title, cls: it.done ? 'lbl-done' : 'lbl-mine' })),
          ];
          const dow = i % 7;
          return (
            <button
              key={iso}
              className={[
                'cal-cell',
                iso === today && 'today',
                iso === selected && 'selected',
                (dow === 0 || holiday) && 'sun',
                dow === 6 && 'sat',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelected(iso)}
              aria-pressed={iso === selected}
              aria-label={`${shortLabel(iso)} ${labels.length}건`}
            >
              <span className="cal-num">{Number(iso.slice(8))}</span>
              {/* 넓은 화면은 제목, 폰은 점으로 보인다 */}
              <span className="cal-marks" aria-hidden>
                {labels.slice(0, 3).map((l) => (
                  <span key={l.key} className={`cal-lbl ${l.cls}`}>
                    {l.text}
                  </span>
                ))}
                {labels.length > 3 && <span className="cal-more">+{labels.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {showSchool && events.error && <p className="hint">학사일정을 못 불러왔어요 ({events.error})</p>}
      {showSchool && <PartialHint partial={events.data?.partial} what="이 달 학사일정" />}

      <div className="day-panel">
        {selected === today ? (
          <p className="hint">날짜를 누르면 그 날 할 일과 학교 일정이 여기에 나와요.</p>
        ) : (
          <>
            <h3 className="date-title">
              <span>{shortLabel(selected)}</span>
              {lunarLabel(selected) && <span className="date-rel">{lunarLabel(selected)}</span>}
            </h3>
            <QuickAdd date={selected} groupId={groupId} placeholder={`${shortLabel(selected)}에 추가`} />
            <SchoolEvents events={dayEvents} />
            <ItemList items={dayItems} hideGroup={!!groupId} />
            {dayItems.length === 0 && dayEvents.length === 0 && <p className="empty-line">이 날은 비어 있어요.</p>}
          </>
        )}
      </div>
    </section>
  );
}

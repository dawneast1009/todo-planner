import { useState } from 'react';
import { useApp } from '../context';
import { ItemList } from '../components/ItemRow';
import { QuickAdd } from '../components/QuickAdd';
import { PartialHint, SchoolEvents, Timetable } from '../components/School';
import { fromISO, makeDate, shortLabel, toISO } from '../lib/date';
import { itemsOnDate } from '../lib/views';
import { useMonthEvents, useTimetable } from '../school';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return toISO(d).slice(0, 7);
}

export function CalendarView() {
  const { items, today, settings } = useApp();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const events = useMonthEvents(settings, month);
  const selectedEvents = useMonthEvents(settings, selected.slice(0, 7));
  const tt = useTimetable(settings, selected);

  const [y, m] = month.split('-').map(Number);
  const first = makeDate(y, m, 1)!;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: Array<string | null> = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(makeDate(y, m, i + 1)!)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayItems = itemsOnDate(items, selected);
  const dayEvents = selectedEvents.data?.events.filter((e) => e.date === selected) ?? [];
  const selDow = fromISO(selected).getDay();

  return (
    <>
      <header className="view-head cal-head">
        <button className="ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
          ‹
        </button>
        <h1>
          {y}년 {m}월
        </h1>
        <button className="ghost" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="다음 달">
          ›
        </button>
        {month !== today.slice(0, 7) && (
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
      </header>

      <div className="calendar" role="grid" aria-label={`${y}년 ${m}월`}>
        {DOW.map((d, i) => (
          <div key={d} className={`cal-dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} className="cal-cell empty" />;
          const mine = itemsOnDate(items, iso);
          const school = events.data?.events.filter((e) => e.date === iso) ?? [];
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
              {labels.slice(0, 3).map((l) => (
                <span key={l.key} className={`cal-lbl ${l.cls}`}>
                  {l.text}
                </span>
              ))}
              {labels.length > 3 && <span className="cal-more">+{labels.length - 3}</span>}
            </button>
          );
        })}
      </div>
      {events.error && <p className="hint">학사일정을 못 불러왔어요 ({events.error})</p>}
      <PartialHint partial={events.data?.partial} what="이 달 학사일정" />

      <section className="day-panel">
        <h2>{shortLabel(selected)}</h2>
        <QuickAdd date={selected} placeholder={`${shortLabel(selected)}에 추가`} />
        <SchoolEvents events={dayEvents} />
        <ItemList items={dayItems} />
        {settings.school && selDow >= 1 && selDow <= 5 && (
          <details className="card tt-details">
            <summary>시간표</summary>
            <Timetable
              periods={tt.data?.days[selected]}
              partial={tt.data?.partial}
              loading={tt.loading}
              error={tt.error}
            />
          </details>
        )}
        {dayItems.length === 0 && dayEvents.length === 0 && <p className="empty">이 날은 비어 있어요.</p>}
      </section>
    </>
  );
}

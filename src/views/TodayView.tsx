import { useApp } from '../context';
import { ItemList } from '../components/ItemRow';
import { QuickAdd } from '../components/QuickAdd';
import { SchoolEvents, Timetable } from '../components/School';
import { ddayLabel, fromISO, shortLabel, weekdayName } from '../lib/date';
import { ddayView, todayView } from '../lib/views';
import { useMonthEvents, useWeekTimetable } from '../school';

export function TodayView() {
  const { items, today, settings, openItem } = useApp();
  const v = todayView(items, today);
  const ddays = ddayView(items, settings.importantSchoolEvents, today);
  const tt = useWeekTimetable(settings, today);
  const events = useMonthEvents(settings, today.slice(0, 7));
  const todayEvents = events.data?.filter((e) => e.date === today) ?? [];
  const d = fromISO(today);
  const dow = d.getDay();
  const isWeekday = dow >= 1 && dow <= 5;
  const nothing = v.carried.length === 0 && v.today.length === 0 && v.done.length === 0;

  return (
    <>
      <header className="view-head">
        <h1>
          {d.getMonth() + 1}월 {d.getDate()}일 <span className="muted">{weekdayName(today)}요일</span>
        </h1>
      </header>

      {ddays.length > 0 && (
        <ul className="ddays" aria-label="D-day">
          {ddays.map((x) => {
            const item = x.itemId ? items.find((i) => i.id === x.itemId) : undefined;
            return (
              <li key={x.key}>
                <button
                  className={`dday${x.source === 'school' ? ' school' : ''}`}
                  onClick={() => item && openItem(item)}
                  disabled={!item}
                >
                  <strong>{ddayLabel(x.date, today)}</strong>
                  <span className="dday-title">{x.title}</span>
                  <span className="dday-date">{shortLabel(x.date)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <QuickAdd />

      {settings.school && (isWeekday || todayEvents.length > 0) && (
        <section className="card">
          {isWeekday && <Timetable periods={tt.data?.[today]} loading={tt.loading} error={tt.error} />}
          <SchoolEvents events={todayEvents} />
        </section>
      )}

      {v.carried.length > 0 && (
        <section>
          <h2>밀린 할 일</h2>
          <ItemList items={v.carried} carried />
        </section>
      )}

      <section>
        {v.carried.length > 0 && <h2>오늘</h2>}
        <ItemList items={v.today} />
        {nothing && <p className="empty">오늘 할 일이 없어요. 위에 한 줄 적어보세요.</p>}
      </section>

      {v.done.length > 0 && (
        <section>
          <h2>완료</h2>
          <ItemList items={v.done} />
        </section>
      )}
    </>
  );
}

import { useState } from 'react';
import { useApp } from '../context';
import { ItemList } from '../components/ItemRow';
import { MonthCalendar } from '../components/MonthCalendar';
import { QuickAdd } from '../components/QuickAdd';
import { SchoolEvents } from '../components/School';
import { WeekTimetable } from '../components/WeekTimetable';
import { ddayLabel, diffDays, fromISO, relativeLabel, shortLabel, weekdayName } from '../lib/date';
import { ddayView, somedayView, todayView, upcomingView } from '../lib/views';
import { useMonthEvents } from '../school';

/** 오늘·예정·언젠가·달력·그룹을 한 화면에. 그룹은 위쪽 칩으로 거른다. */
export function MainView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { items, today, settings, groups, openItem } = useApp();
  const [filterId, setFilterId] = useState<string | null>(null);
  const filter = groups.find((g) => g.id === filterId) ?? null;
  const visible = filter ? items.filter((i) => i.groupId === filter.id) : items;

  const t = todayView(visible, today);
  const upcoming = upcomingView(visible, today);
  const someday = somedayView(visible, today);
  const ddays = ddayView(visible, filter ? [] : settings.importantSchoolEvents, today);

  const events = useMonthEvents(settings, today.slice(0, 7));
  const todayEvents = events.data?.events.filter((e) => e.date === today) ?? [];
  const d = fromISO(today);
  const todayEmpty = t.carried.length === 0 && t.today.length === 0 && t.done.length === 0;
  const sortedGroups = groups.slice().sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="main-grid">
      <div className="main-col">
        <header className="view-head">
          <h1>
            {d.getMonth() + 1}월 {d.getDate()}일 <span className="muted">{weekdayName(today)}요일</span>
          </h1>
          <button className="ghost icon-btn" onClick={onOpenSettings} aria-label="설정">
            ⚙
          </button>
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

        <QuickAdd groupId={filter?.id ?? null} placeholder={filter ? `#${filter.name}에 추가` : undefined} />

        {sortedGroups.length > 0 && (
          <div className="group-chips" role="group" aria-label="그룹으로 보기">
            <button className={!filter ? 'on' : ''} aria-pressed={!filter} onClick={() => setFilterId(null)}>
              전체
            </button>
            {sortedGroups.map((g) => (
              <button
                key={g.id}
                className={filter?.id === g.id ? 'on' : ''}
                aria-pressed={filter?.id === g.id}
                onClick={() => setFilterId(filter?.id === g.id ? null : g.id)}
              >
                #{g.name}
              </button>
            ))}
          </div>
        )}

        {!filter && <WeekTimetable onOpenSettings={onOpenSettings} />}

        <section>
          <h2 className="section-title">오늘</h2>
          {!filter && <SchoolEvents events={todayEvents} />}
          {t.carried.length > 0 && (
            <>
              <h3>밀린 할 일</h3>
              <ItemList items={t.carried} carried hideGroup={!!filter} />
              {t.today.length > 0 && <h3>오늘 할 일</h3>}
            </>
          )}
          <ItemList items={t.today} hideGroup={!!filter} />
          {todayEmpty && (filter || todayEvents.length === 0) && <p className="hint">오늘은 비어 있어요.</p>}
          {t.done.length > 0 && (
            <>
              <h3>완료</h3>
              <ItemList items={t.done} hideGroup={!!filter} />
            </>
          )}
        </section>

        <section>
          <h2 className="section-title">예정</h2>
          {upcoming.length === 0 && <p className="hint">앞으로 잡힌 게 없어요.</p>}
          {upcoming.map((b) => {
            const rel = relativeLabel(b.date, today);
            return (
              <div key={b.date} className="bucket">
                <h3>
                  {shortLabel(b.date)}
                  <span className="muted"> · {rel.includes('/') ? `${diffDays(today, b.date)}일 뒤` : rel}</span>
                </h3>
                <ItemList items={b.items} hideGroup={!!filter} />
              </div>
            );
          })}
        </section>

        {someday.length > 0 && (
          <section>
            <h2 className="section-title">
              언젠가 <span className="muted">· 날짜 없음</span>
            </h2>
            <ItemList items={someday} hideGroup={!!filter} />
          </section>
        )}
      </div>

      <aside className="side-col">
        <MonthCalendar items={visible} groupId={filter?.id ?? null} showSchool={!filter} />
      </aside>
    </div>
  );
}

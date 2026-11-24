import { useState } from 'react';
import { useApp } from '../context';
import { ItemList } from '../components/ItemRow';
import { MonthCalendar } from '../components/MonthCalendar';
import { QuickAdd } from '../components/QuickAdd';
import { SchoolEvents } from '../components/School';
import { WeekTimetable } from '../components/WeekTimetable';
import { useMediaQuery } from '../hooks';
import { addDays, ddayLabel, diffDays, fromISO, relativeLabel, shortLabel, weekdayName } from '../lib/date';
import { expandItems, nextOccurrences } from '../lib/repeat';
import { ddayView, somedayView, todayView, upcomingView } from '../lib/views';
import { useMonthEvents } from '../school';

function Count({ n }: { n: number }) {
  return n > 0 ? <span className="count">{n}</span> : null;
}

/**
 * 오늘·시간표·예정·언젠가·달력을 한 화면에. 그룹은 위쪽 칩으로 거른다.
 * 폰: 한 줄로 쭉. 넓은 화면: 왼쪽 할 일 목록, 오른쪽 시간표와 달력.
 */
export function MainView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { items, today, settings, groups, openItem, moveItems } = useApp();
  const wide = useMediaQuery('(min-width: 1000px)');
  const [filterId, setFilterId] = useState<string | null>(null);
  const filter = groups.find((g) => g.id === filterId) ?? null;
  const visible = filter ? items.filter((i) => i.groupId === filter.id) : items;

  // 반복 항목은 화면마다 필요한 날짜만 펼친다: 오늘은 오늘 것, 예정은 다음 한 번만
  const plain = visible.filter((i) => !i.repeat);
  const series = visible.filter((i) => i.repeat);
  const t = todayView([...plain, ...expandItems(series, today, today)], today);
  // 매일 반복은 예정에 늘 '내일'로 떠서 시끄러우니 뺀다 (오늘과 달력에는 나온다)
  const upcoming = upcomingView(
    [...plain, ...nextOccurrences(series.filter((s) => s.repeat?.freq !== 'daily'), addDays(today, 1))],
    today,
  );
  const someday = somedayView(plain, today);
  const ddays = ddayView(
    [...plain, ...nextOccurrences(series, today)],
    filter ? [] : settings.importantSchoolEvents,
    today,
  );
  const upcomingCount = upcoming.reduce((n, b) => n + b.items.filter((i) => !i.done).length, 0);

  const events = useMonthEvents(settings, today.slice(0, 7));
  const todayEvents = filter ? [] : (events.data?.events.filter((e) => e.date === today) ?? []);
  const d = fromISO(today);
  const todayOpen = t.carried.length + t.today.length;
  const todayEmpty = todayOpen === 0 && t.done.length === 0 && todayEvents.length === 0;
  const sortedGroups = groups.slice().sort((a, b) => a.createdAt - b.createdAt);

  const timetable = !filter && <WeekTimetable onOpenSettings={onOpenSettings} />;

  return (
    <div className="main-grid">
      <div className="main-col">
        <header className="view-head">
          <h1>
            {d.getMonth() + 1}월 {d.getDate()}일 <span className="muted">{weekdayName(today)}요일</span>
          </h1>
          <button className="settings-btn" onClick={onOpenSettings}>
            <span aria-hidden>⚙</span> 설정
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

        <section className="block">
          <h2 className="section-title">
            오늘 <Count n={todayOpen} />
          </h2>
          <SchoolEvents events={todayEvents} />
          {t.carried.length > 0 && (
            <>
              <div className="sub-head">
                <h3 className="sub-title warn">밀린 할 일 {t.carried.length}</h3>
                <button className="mini-btn" onClick={() => moveItems(t.carried, today, '오늘')}>
                  모두 오늘로
                </button>
                <button className="mini-btn" onClick={() => moveItems(t.carried, addDays(today, 1), '내일')}>
                  모두 내일로
                </button>
              </div>
              <ItemList items={t.carried} carried hideGroup={!!filter} />
              {t.today.length > 0 && <h3 className="sub-title">오늘 할 일</h3>}
            </>
          )}
          <ItemList items={t.today} hideGroup={!!filter} />
          {todayEmpty && <p className="empty-line">오늘은 비어 있어요. 위에 한 줄 적어보세요.</p>}
          {t.done.length > 0 && (
            <>
              <h3 className="sub-title">완료 {t.done.length}</h3>
              <ItemList items={t.done} hideGroup={!!filter} />
            </>
          )}
        </section>

        {!wide && timetable}

        <section className="block">
          <h2 className="section-title">
            예정 <Count n={upcomingCount} />
          </h2>
          {upcoming.length === 0 && <p className="empty-line">앞으로 잡힌 게 없어요.</p>}
          {upcoming.map((b) => {
            const rel = relativeLabel(b.date, today);
            const n = diffDays(today, b.date);
            return (
              <div key={b.date} className="bucket">
                <h3 className="date-title">
                  <span>{shortLabel(b.date)}</span>
                  <span className={`date-rel${n <= 2 ? ' soon' : ''}`}>{rel.includes('/') ? `${n}일 뒤` : rel}</span>
                </h3>
                <ItemList items={b.items} hideGroup={!!filter} />
              </div>
            );
          })}
        </section>

        {someday.length > 0 && (
          <section className="block">
            <h2 className="section-title">
              언젠가 <Count n={someday.filter((i) => !i.done).length} />
            </h2>
            <ItemList items={someday} hideGroup={!!filter} />
          </section>
        )}
      </div>

      <aside className="side-col">
        {wide && timetable}
        <MonthCalendar items={visible} groupId={filter?.id ?? null} showSchool={!filter} />
      </aside>
    </div>
  );
}

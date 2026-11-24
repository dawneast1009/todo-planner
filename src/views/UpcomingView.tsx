import { useApp } from '../context';
import { ItemList } from '../components/ItemRow';
import { QuickAdd } from '../components/QuickAdd';
import { diffDays, relativeLabel, shortLabel } from '../lib/date';
import { somedayView, upcomingView } from '../lib/views';

export function UpcomingView() {
  const { items, today } = useApp();
  const buckets = upcomingView(items, today);
  const someday = somedayView(items, today);

  return (
    <>
      <header className="view-head">
        <h1>예정</h1>
      </header>
      <QuickAdd />

      {buckets.length === 0 && someday.length === 0 && (
        <p className="empty">앞으로 할 일이 없어요. 날짜를 붙여 적으면 여기에 모여요.</p>
      )}

      {buckets.map((b) => {
        const rel = relativeLabel(b.date, today);
        const n = diffDays(today, b.date);
        return (
          <section key={b.date}>
            <h2>
              {shortLabel(b.date)}
              <span className="muted"> · {rel.includes('/') ? `${n}일 뒤` : rel}</span>
            </h2>
            <ItemList items={b.items} />
          </section>
        );
      })}

      {someday.length > 0 && (
        <section>
          <h2>
            언젠가 <span className="muted">· 날짜 없음</span>
          </h2>
          <ItemList items={someday} />
        </section>
      )}
    </>
  );
}

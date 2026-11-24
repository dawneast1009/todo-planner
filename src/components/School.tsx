import { useApp } from '../context';
import type { SchoolEvent } from '../lib/neis';
import { schoolEventKey } from '../lib/views';

/** 키 없이 받아서 일부만 보일 때 붙이는 안내 */
export function PartialHint({ partial, what }: { partial: boolean | undefined; what: string }) {
  if (!partial) return null;
  return <p className="hint">인증키가 없어서 {what} 일부만 보여요. 설정에서 나이스 인증키를 넣으면 전부 보여요.</p>;
}

/** 학사일정 목록. 별을 누르면 D-day가 켜진다. */
export function SchoolEvents({ events }: { events: SchoolEvent[] }) {
  const { settings, toggleSchoolDday } = useApp();
  if (events.length === 0) return null;
  return (
    <ul className="school-events">
      {events.map((e) => {
        const key = schoolEventKey(e);
        const on = settings.importantSchoolEvents.includes(key);
        return (
          <li key={key} className={e.holiday ? 'holiday' : ''}>
            <span className="school-badge">학교</span>
            <span className="school-name">{e.name}</span>
            <button
              className={`dday-toggle${on ? ' on' : ''}`}
              onClick={() => toggleSchoolDday(key)}
              aria-pressed={on}
              aria-label={on ? 'D-day 끄기' : 'D-day 켜기'}
              title={on ? 'D-day 끄기' : 'D-day 켜기'}
            >
              {on ? '★' : '☆'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

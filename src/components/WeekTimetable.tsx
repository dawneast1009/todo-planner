import { useState } from 'react';
import { useApp } from '../context';
import { addDays, fromISO, mondayOf } from '../lib/date';
import { useTimetable } from '../school';
import { PartialHint } from './School';

const DAYS = ['월', '화', '수', '목', '금'];

/** 한 주 시간표 표 (월~금 × 교시). 오늘 요일 칸을 강조한다. */
export function WeekTimetable({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { today, settings } = useApp();
  // 주말에는 다음 주를 먼저 보여준다
  const todayDow = fromISO(today).getDay();
  const initial = todayDow === 0 || todayDow === 6 ? addDays(mondayOf(today), 7) : mondayOf(today);
  const [monday, setMonday] = useState(initial);
  const tt = useTimetable(settings, monday);
  const school = settings.school;

  if (!school) {
    return (
      <section className="card timetable-card">
        <h2 className="section-title">시간표</h2>
        <p className="hint">학교·학년·반을 설정하면 이 칸에 시간표가 나와요.</p>
        <button className="primary" onClick={onOpenSettings}>
          학교 설정하기
        </button>
      </section>
    );
  }

  const dates = DAYS.map((_, i) => addDays(monday, i));
  const maxPeriod = Math.max(0, ...dates.map((d) => (tt.data?.days[d] ?? []).reduce((m, p) => Math.max(m, p.period), 0)));
  const fri = fromISO(dates[4]);
  const mon = fromISO(monday);

  return (
    <section className="card timetable-card">
      <div className="tt-head">
        <h2 className="section-title">시간표</h2>
        <span className="muted tt-range">
          {mon.getMonth() + 1}/{mon.getDate()} ~ {fri.getMonth() + 1}/{fri.getDate()}
        </span>
        <button className="ghost" onClick={() => setMonday(addDays(monday, -7))} aria-label="이전 주">
          ‹
        </button>
        <button className="ghost" onClick={() => setMonday(addDays(monday, 7))} aria-label="다음 주">
          ›
        </button>
        {monday !== initial && (
          <button className="ghost small" onClick={() => setMonday(initial)}>
            이번 주
          </button>
        )}
      </div>

      {maxPeriod > 0 ? (
        <div className="tt-scroll">
          <table className="tt-grid">
            <thead>
              <tr>
                <th aria-label="교시" />
                {dates.map((d, i) => (
                  <th key={d} className={d === today ? 'is-today' : ''}>
                    {DAYS[i]}
                    <span className="tt-date">{fromISO(d).getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((period) => (
                <tr key={period}>
                  <th scope="row">{period}</th>
                  {dates.map((d) => (
                    <td key={d} className={d === today ? 'is-today' : ''}>
                      {tt.data?.days[d]?.find((p) => p.period === period)?.subject ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tt.loading ? (
        <p className="hint">시간표 불러오는 중…</p>
      ) : tt.error ? (
        <p className="hint">시간표를 못 불러왔어요 ({tt.error})</p>
      ) : (
        <p className="hint">이 주에는 시간표가 없어요. (방학이거나 아직 나이스에 안 올라왔을 수 있어요)</p>
      )}
      <PartialHint partial={tt.data?.partial} what="시간표" />
      <p className="hint tt-school">
        {school.schoolName} {school.grade}학년 {school.className}반
      </p>
    </section>
  );
}

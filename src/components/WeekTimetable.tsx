import { useState } from 'react';
import { useApp } from '../context';
import { addDays, fromISO, mondayOf } from '../lib/date';
import { useTimetable, useWeekMeals } from '../school';
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
      <WeekMeals key={monday} dates={dates} />
      <p className="hint tt-school">
        {school.schoolName} {school.grade}학년 {school.className}반
      </p>
    </section>
  );
}

/** 시간표 아래 급식. 요일을 누르면 그 날 메뉴가 나온다 (처음엔 오늘). */
function WeekMeals({ dates }: { dates: string[] }) {
  const { today, settings } = useApp();
  const [selected, setSelected] = useState(dates.includes(today) ? today : dates[0]);
  const meals = useWeekMeals(settings, dates[0]);
  const dayMeals = meals.data?.days[selected] ?? [];

  return (
    <div className="meals">
      <div className="meals-head">
        <h3 className="sub-title">급식</h3>
        <div className="meal-days" role="tablist" aria-label="급식 요일">
          {dates.map((d, i) => (
            <button
              key={d}
              role="tab"
              aria-selected={d === selected}
              className={`${d === selected ? 'on' : ''}${d === today ? ' is-today' : ''}`}
              onClick={() => setSelected(d)}
            >
              {DAYS[i]}
            </button>
          ))}
        </div>
      </div>
      {dayMeals.length > 0 ? (
        <div className="meal-list">
          {dayMeals.map((m) => (
            <div key={m.kind} className="meal">
              <div className="meal-kind">
                {m.kind}
                {m.calories && <span className="muted"> · {m.calories}</span>}
              </div>
              <p className="meal-dishes">{m.dishes.join(' · ')}</p>
            </div>
          ))}
        </div>
      ) : meals.loading ? (
        <p className="hint">급식 불러오는 중…</p>
      ) : meals.error ? (
        <p className="hint">급식을 못 불러왔어요 ({meals.error})</p>
      ) : (
        <p className="hint">이 날은 급식 정보가 없어요.</p>
      )}
    </div>
  );
}

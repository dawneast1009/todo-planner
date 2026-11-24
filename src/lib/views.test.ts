import { describe, expect, it } from 'vitest';
import type { Item } from '../store/types';
import { ddayView, groupView, somedayView, todayView, upcomingView } from './views';

const TODAY = '2026-11-24';
let seq = 0;
function item(over: Partial<Item>): Item {
  seq++;
  return {
    id: `i${seq}`,
    title: `항목${seq}`,
    memo: '',
    date: null,
    time: null,
    kind: 'todo',
    done: false,
    doneOn: null,
    important: false,
    groupId: null,
    createdAt: seq,
    updatedAt: seq,
    ...over,
  };
}

describe('todayView', () => {
  it('오늘 날짜 항목은 시간순, 시간 없는 것은 뒤로', () => {
    const a = item({ date: TODAY });
    const b = item({ date: TODAY, time: '15:00', kind: 'event' });
    const c = item({ date: TODAY, time: '09:00' });
    expect(todayView([a, b, c], TODAY).today.map((i) => i.id)).toEqual([c.id, b.id, a.id]);
  });

  it('못 한 할 일은 다음 날로 넘어온다', () => {
    const old = item({ date: '2026-11-22' });
    expect(todayView([old], TODAY).carried).toEqual([old]);
  });

  it('지난 일정(약속)은 넘어오지 않는다', () => {
    const ev = item({ date: '2026-11-23', kind: 'event', time: '10:00' });
    const v = todayView([ev], TODAY);
    expect(v.carried).toEqual([]);
    expect(v.today).toEqual([]);
  });

  it('미리 적은 항목은 그 날이 되면 오늘에 올라온다', () => {
    const future = item({ date: '2026-11-25' });
    expect(todayView([future], TODAY).today).toEqual([]);
    expect(todayView([future], '2026-11-25').today).toEqual([future]);
  });

  it('오늘 체크한 것은 완료 목록에 남고, 다음 날 사라진다', () => {
    const d = item({ date: '2026-11-20', done: true, doneOn: TODAY });
    expect(todayView([d], TODAY).done).toEqual([d]);
    expect(todayView([d], '2026-11-25').done).toEqual([]);
  });

  it('날짜 없는 항목은 오늘에 나오지 않는다', () => {
    expect(todayView([item({})], TODAY)).toEqual({ carried: [], today: [], done: [] });
  });
});

describe('upcomingView', () => {
  it('내일 이후를 날짜별로 묶는다', () => {
    const a = item({ date: '2026-11-30' });
    const b = item({ date: '2026-11-25' });
    const c = item({ date: '2026-11-25', time: '08:00' });
    const t = item({ date: TODAY });
    const v = upcomingView([a, b, c, t], TODAY);
    expect(v.map((x) => x.date)).toEqual(['2026-11-25', '2026-11-30']);
    expect(v[0].items.map((i) => i.id)).toEqual([c.id, b.id]);
  });

  it('예전에 체크한 것은 빠진다', () => {
    const d = item({ date: '2026-11-30', done: true, doneOn: '2026-11-20' });
    expect(upcomingView([d], TODAY)).toEqual([]);
  });
});

describe('somedayView', () => {
  it('날짜 없는 항목만', () => {
    const s = item({});
    expect(somedayView([s, item({ date: TODAY })], TODAY)).toEqual([s]);
  });
});

describe('groupView', () => {
  it('날짜 있는 것 먼저, 지난 일정은 빼고', () => {
    const g = 'g1';
    const someday = item({ groupId: g });
    const later = item({ groupId: g, date: '2026-12-01' });
    const sooner = item({ groupId: g, date: '2026-11-25' });
    const pastEvent = item({ groupId: g, date: '2026-11-20', kind: 'event' });
    const other = item({ groupId: 'g2', date: '2026-11-25' });
    expect(groupView([someday, later, sooner, pastEvent, other], g, TODAY).map((i) => i.id)).toEqual([
      sooner.id,
      later.id,
      someday.id,
    ]);
  });
});

describe('ddayView', () => {
  it('중요 표시한 항목과 학사일정을 날짜순으로', () => {
    const exam = item({ date: '2026-12-10', important: true, title: '수학 발표' });
    const notImportant = item({ date: '2026-12-01' });
    const past = item({ date: '2026-11-01', important: true });
    const v = ddayView([exam, notImportant, past], ['2026-12-03|2학기 기말고사', '2026-11-01|지난 행사'], TODAY);
    expect(v.map((d) => [d.date, d.title, d.source])).toEqual([
      ['2026-12-03', '2학기 기말고사', 'school'],
      ['2026-12-10', '수학 발표', 'item'],
    ]);
  });
});

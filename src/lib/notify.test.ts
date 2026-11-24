import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Item, type Settings } from '../store/types';
import { EMPTY_NOTIFY_STATE, planNotifications, seoulNow } from './notify';

const TODAY = '2026-11-24';
let n = 0;
const item = (over: Partial<Item>): Item => ({
  id: `i${++n}`,
  title: '항목',
  memo: '',
  date: TODAY,
  time: null,
  kind: 'todo',
  done: false,
  doneOn: null,
  important: false,
  groupId: null,
  createdAt: n,
  updatedAt: n,
  ...over,
});
const settings = (notify?: Settings['notify']): Settings => ({ ...DEFAULT_SETTINGS, notify });
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

describe('아침 요약', () => {
  const items = [
    item({ title: '영어 단어' }),
    item({ title: '치과', time: '15:00', kind: 'event' }),
    item({ title: '오답노트', date: '2026-11-22' }),
    item({ title: '기말고사', date: '2026-11-25', important: true }),
  ];

  it('설정한 시각이 되면 한 번 보낸다', () => {
    const before = planNotifications(items, settings(), EMPTY_NOTIFY_STATE, TODAY, at('07:20'));
    expect(before.messages).toEqual([]);

    const first = planNotifications(items, settings(), EMPTY_NOTIFY_STATE, TODAY, at('07:31'));
    expect(first.messages).toHaveLength(1);
    expect(first.messages[0].title).toBe('오늘 할 일 2개');
    // 앱 화면과 같은 순서: 시간 있는 것 먼저
    expect(first.messages[0].body).toBe('오후 3:00 치과\n영어 단어\n밀린 할 일 1개\nD-1 기말고사');

    const again = planNotifications(items, settings(), first.state, TODAY, at('07:40'));
    expect(again.messages).toEqual([]);
  });

  it('너무 늦게 돌면(3시간 넘게) 그 날은 건너뛴다', () => {
    const late = planNotifications(items, settings(), EMPTY_NOTIFY_STATE, TODAY, at('11:00'));
    expect(late.messages.filter((m) => m.tag.startsWith('morning'))).toEqual([]);
    expect(late.state.morningSentOn).toBe(TODAY);
  });

  it('끌 수 있다', () => {
    const off = planNotifications(items, settings({ morning: '', eventLead: 0 }), EMPTY_NOTIFY_STATE, TODAY, at('08:00'));
    expect(off.messages).toEqual([]);
  });

  it('알릴 게 없으면 보내지 않는다', () => {
    const empty = planNotifications([], settings(), EMPTY_NOTIFY_STATE, TODAY, at('07:30'));
    expect(empty.messages).toEqual([]);
  });
});

describe('일정 알림', () => {
  const s = settings({ morning: '', eventLead: 30 });

  it('30분 전부터 시각까지 한 번만', () => {
    const items = [item({ title: '치과', time: '15:00', kind: 'event' })];
    expect(planNotifications(items, s, EMPTY_NOTIFY_STATE, TODAY, at('14:20')).messages).toEqual([]);
    const p = planNotifications(items, s, EMPTY_NOTIFY_STATE, TODAY, at('14:35'));
    expect(p.messages).toEqual([{ title: '오후 3:00 치과', body: '25분 뒤예요', tag: expect.any(String) }]);
    expect(planNotifications(items, s, p.state, TODAY, at('14:45')).messages).toEqual([]);
  });

  it('체크한 것과 지난 것은 안 보낸다', () => {
    const items = [
      item({ title: '끝남', time: '15:00', done: true, doneOn: TODAY }),
      item({ title: '지남', time: '13:00' }),
    ];
    expect(planNotifications(items, s, EMPTY_NOTIFY_STATE, TODAY, at('14:50')).messages).toEqual([]);
  });

  it('반복 항목도 그 날 것으로 알린다', () => {
    const items = [item({ title: '학원', date: '2026-11-23', time: '16:00', kind: 'event', repeat: { freq: 'weekly', days: [2] } })];
    expect(planNotifications(items, s, EMPTY_NOTIFY_STATE, TODAY, at('15:40')).messages[0].title).toBe('오후 4:00 학원');
  });

  it('어제 보낸 기록은 지운다', () => {
    const prev = { morningSentOn: null, reminded: ['x|2026-11-23|10:00', 'y|2026-11-24|10:00'] };
    expect(planNotifications([], s, prev, TODAY, at('09:00')).state.reminded).toEqual(['y|2026-11-24|10:00']);
  });
});

describe('seoulNow', () => {
  it('UTC를 한국 시간으로', () => {
    expect(seoulNow(new Date('2026-11-23T22:30:00Z'))).toEqual({ today: '2026-11-24', nowMin: 7 * 60 + 30 });
  });
});

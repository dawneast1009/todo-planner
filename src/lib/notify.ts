// 알림을 언제 무엇을 보낼지 정하는 순수 함수.
// 서버(GitHub Actions)에서 몇 분마다 불리고, 같은 알림을 두 번 보내지 않도록 상태(state)를 돌려준다.
import { DEFAULT_NOTIFY, type Item, type Settings } from '../store/types';
import { addDays, ddayLabel, timeLabel } from './date';
import { expandItems, nextOccurrences } from './repeat';
import { todayView } from './views';

export interface NotifyState {
  /** 아침 요약을 보낸 날짜 */
  morningSentOn: string | null;
  /** 이미 보낸 일정 알림 키 ('항목id|날짜|시각') — 오늘 것만 남긴다 */
  reminded: string[];
}

export const EMPTY_NOTIFY_STATE: NotifyState = { morningSentOn: null, reminded: [] };

export interface PushMessage {
  title: string;
  body: string;
  /** 같은 tag 알림은 폰에서 하나로 합쳐진다 */
  tag: string;
}

export interface NotifyPlan {
  messages: PushMessage[];
  state: NotifyState;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 아침 요약을 놓쳤어도 이 시간(분) 안에는 보낸다. 그보다 늦으면 그 날은 건너뛴다. */
const MORNING_WINDOW = 180;
/** 일정 시각이 지난 뒤에도 이만큼(분)은 늦게라도 보낸다 (GitHub 예약 실행이 늦을 때 대비) */
const LATE_GRACE = 5;

/**
 * @param today 한국 시간 기준 'YYYY-MM-DD'
 * @param nowMin 한국 시간 기준 자정부터 지난 분
 */
export function planNotifications(
  items: Item[],
  settings: Settings,
  prev: NotifyState,
  today: string,
  nowMin: number,
): NotifyPlan {
  const notify = { ...DEFAULT_NOTIFY, ...settings.notify };
  const messages: PushMessage[] = [];
  const state: NotifyState = {
    morningSentOn: prev.morningSentOn,
    // 지난 날짜 키는 버린다
    reminded: prev.reminded.filter((k) => k.split('|')[1] === today),
  };

  const plain = items.filter((i) => !i.repeat);
  const series = items.filter((i) => i.repeat);
  const todays = [...plain, ...expandItems(series, today, today)];

  // 1) 아침 요약
  if (notify.morning && state.morningSentOn !== today) {
    const start = toMin(notify.morning);
    if (nowMin >= start) {
      state.morningSentOn = today;
      if (nowMin < start + MORNING_WINDOW) {
        const msg = morningSummary(todays, [...plain, ...nextOccurrences(series, today)], today);
        if (msg) messages.push(msg);
      }
    }
  }

  // 2) 시간 있는 항목 몇 분 전 알림
  if (notify.eventLead > 0) {
    for (const it of todays) {
      if (it.date !== today || !it.time || it.done) continue;
      const at = toMin(it.time);
      const key = `${it.seriesId ?? it.id}|${today}|${it.time}`;
      if (state.reminded.includes(key)) continue;
      if (nowMin >= at - notify.eventLead && nowMin <= at + LATE_GRACE) {
        const left = at - nowMin;
        messages.push({
          title: `${timeLabel(it.time)} ${it.title}`,
          body: left > 0 ? `${left}분 뒤예요` : '지금이에요',
          tag: `event-${key}`,
        });
        state.reminded.push(key);
      }
    }
  }

  return { messages, state };
}

/** '오늘 할 일 3개 · 밀린 일 1개' 같은 요약. 알릴 게 없으면 null. */
export function morningSummary(todays: Item[], forDday: Item[], today: string): PushMessage | null {
  const v = todayView(todays, today);
  const open = [...v.today];
  const lines: string[] = [];
  for (const it of open.slice(0, 4)) lines.push(it.time ? `${timeLabel(it.time)} ${it.title}` : it.title);
  if (open.length > 4) lines.push(`외 ${open.length - 4}개`);
  if (v.carried.length) lines.push(`밀린 할 일 ${v.carried.length}개`);

  // 오늘·내일 D-day
  const soon = forDday.filter(
    (i) => i.important && !i.done && i.date && i.date >= today && i.date <= addDays(today, 1),
  );
  for (const d of soon) lines.push(`${ddayLabel(d.date!, today)} ${d.title}`);

  if (open.length === 0 && v.carried.length === 0 && soon.length === 0) return null;
  const title = open.length ? `오늘 할 일 ${open.length}개` : v.carried.length ? '밀린 할 일이 있어요' : '다가오는 D-day';
  return { title, body: lines.join('\n'), tag: `morning-${today}` };
}

/** 한국 시간 기준 오늘 날짜와 분 */
export function seoulNow(now: Date = new Date()): { today: string; nowMin: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    today: `${get('year')}-${get('month')}-${get('day')}`,
    nowMin: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

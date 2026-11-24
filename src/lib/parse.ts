import type { RepeatRule } from '../store/types';
import { addDays, fromISO, makeDate, mondayOf, toISO } from './date';
import { firstDateFor } from './repeat';

/**
 * 입력창 한 줄을 제목·날짜·시간·그룹으로 나눈다.
 *
 *   "내일 3시 치과"          → 내일, 15:00, "치과"
 *   "금요일까지 수학 과제"    → 다가오는 금요일, "수학 과제"
 *   "12/5 영어 발표 #수행평가" → 12월 5일, 그룹 "수행평가", "영어 발표"
 *   "우유 사기"              → 날짜 없음(언젠가)
 *
 * 날짜 표현은 첫 번째 것 하나만 쓰고, 해석에 쓴 부분은 제목에서 뺀다.
 */
export interface Parsed {
  title: string;
  /** 반복이면 첫 반복 날짜 */
  date: string | null;
  time: string | null;
  group: string | null;
  repeat: RepeatRule | null;
}

// 한글에는 \b가 통하지 않아서 공백·문장 끝을 경계로 쓴다.
// 날짜·시간 뒤에 붙는 '까지', '에'는 같이 지운다.
const B = '(?<=^|\\s)';
const E = '(?:까지|에)?(?=$|\\s)';

type DateRule = {
  re: RegExp;
  resolve: (m: RegExpExecArray, today: string) => string | null;
};

const WEEKDAY = '일월화수목금토';

/** 연도가 없는 월/일: 올해 날짜가 이미 지났으면 내년으로 본다. */
function resolveMonthDay(month: number, day: number, today: string): string | null {
  const year = fromISO(today).getFullYear();
  const d = makeDate(year, month, day);
  if (!d) return null;
  const iso = toISO(d);
  if (iso >= today) return iso;
  const next = makeDate(year + 1, month, day);
  return next ? toISO(next) : null;
}

const DATE_RULES: DateRule[] = [
  {
    // 2026-12-05, 2026.12.5, 2026/12/5
    re: new RegExp(`${B}(\\d{4})[-./](\\d{1,2})[-./](\\d{1,2})${E}`),
    resolve: (m) => {
      const d = makeDate(+m[1], +m[2], +m[3]);
      return d ? toISO(d) : null;
    },
  },
  {
    // 3일 뒤, 2주 후
    re: new RegExp(`${B}(\\d{1,3})(일|주)\\s*(?:뒤|후)${E}`),
    resolve: (m, today) => addDays(today, +m[1] * (m[2] === '주' ? 7 : 1)),
  },
  {
    // 12월 5일
    re: new RegExp(`${B}(\\d{1,2})월\\s*(\\d{1,2})일${E}`),
    resolve: (m, today) => resolveMonthDay(+m[1], +m[2], today),
  },
  {
    // 12/5
    re: new RegExp(`${B}(\\d{1,2})/(\\d{1,2})${E}`),
    resolve: (m, today) => resolveMonthDay(+m[1], +m[2], today),
  },
  {
    // 금요일, 금욜, 다음주 월요일, 이번 주 수요일
    re: new RegExp(`${B}(?:(이번\\s*주|다음\\s*주|담주|다다음\\s*주)\\s*)?([${WEEKDAY}])(?:요일|욜)${E}`),
    resolve: (m, today) => {
      const target = WEEKDAY.indexOf(m[2]);
      const prefix = (m[1] ?? '').replace(/\s/g, '');
      if (!prefix) {
        // 그냥 '금요일'은 오늘 포함 가장 가까운 그 요일
        const todayDow = fromISO(today).getDay();
        return addDays(today, (target - todayDow + 7) % 7);
      }
      const weeks = prefix === '이번주' ? 0 : prefix === '다다음주' ? 2 : 1;
      // 주는 월요일부터 일요일까지로 본다
      const offsetFromMonday = (target + 6) % 7;
      return addDays(mondayOf(today), weeks * 7 + offsetFromMonday);
    },
  },
  {
    re: new RegExp(`${B}(오늘|내일|낼|모레|글피)${E}`),
    resolve: (m, today) => {
      const n = { 오늘: 0, 내일: 1, 낼: 1, 모레: 2, 글피: 3 }[m[1]] ?? 0;
      return addDays(today, n);
    },
  },
  {
    // 5일 → 이번 달 5일, 지났으면 다음 달 5일
    re: new RegExp(`${B}(\\d{1,2})일${E}`),
    resolve: (m, today) => {
      const t = fromISO(today);
      const day = +m[1];
      for (let i = 0; i < 3; i++) {
        const d = makeDate(t.getFullYear(), t.getMonth() + 1 + i, day);
        if (d && toISO(d) >= today) return toISO(d);
      }
      return null;
    },
  },
];

const PM = ['오후', '저녁', '밤', '낮'];
const AM = ['오전', '아침', '새벽'];

function to24(hour: number, period: string | undefined, bare: boolean): number | null {
  let h = hour;
  if (period && PM.includes(period)) {
    if (h < 12) h += 12;
  } else if (period && AM.includes(period)) {
    if (h === 12) h = 0;
  } else if (bare && h >= 1 && h <= 6) {
    // '3시'처럼 오전/오후가 없으면 1~6시는 오후로 본다
    h += 12;
  }
  return h >= 0 && h <= 23 ? h : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

type TimeRule = { re: RegExp; resolve: (m: RegExpExecArray) => string | null };

const TIME_RULES: TimeRule[] = [
  {
    // 3시, 오후 3시, 3시 30분, 3시 반
    re: new RegExp(
      `${B}(?:(${[...PM, ...AM].join('|')})\\s*)?(\\d{1,2})시(?:\\s*(\\d{1,2})분|\\s*(반))?${E}`,
    ),
    resolve: (m) => {
      const h = to24(+m[2], m[1], true);
      const min = m[4] ? 30 : m[3] ? +m[3] : 0;
      if (h === null || min > 59) return null;
      return `${pad(h)}:${pad(min)}`;
    },
  },
  {
    // 15:30, 오후 3:30
    re: new RegExp(`${B}(?:(오전|오후)\\s*)?(\\d{1,2}):(\\d{2})${E}`),
    resolve: (m) => {
      const bare = m[2].length === 1;
      const h = to24(+m[2], m[1], bare);
      const min = +m[3];
      if (h === null || min > 59) return null;
      return `${pad(h)}:${pad(min)}`;
    },
  },
];

const GROUP_RE = new RegExp(`${B}#(\\S+)`);

type RepeatRuleDef = { re: RegExp; resolve: (m: RegExpExecArray, today: string) => RepeatRule | null };

// 반복 표현. 요일 날짜 규칙보다 먼저 봐야 '매주 월요일'의 '월요일'을 날짜로 잡지 않는다.
/** 매년 규칙이 실제로 있는 날짜인지 (양력은 윤년 기준으로 2월 29일까지 허용) */
function yearly(month: number, day: number, lunar: boolean): RepeatRule | null {
  if (lunar) return month >= 1 && month <= 12 && day >= 1 && day <= 30 ? { freq: 'yearly', month, day, lunar: true } : null;
  return makeDate(2024, month, day) ? { freq: 'yearly', month, day } : null;
}

const YEARLY = '(?:매년|해마다)';

const REPEAT_RULES: RepeatRuleDef[] = [
  {
    // 매년 3월 15일, 매년 음력 3월 15일
    re: new RegExp(`${B}${YEARLY}\\s*(음력\\s*)?(\\d{1,2})월\\s*(\\d{1,2})일${E}`),
    resolve: (m) => yearly(+m[2], +m[3], !!m[1]),
  },
  {
    // 매년 3/15, 매년 음력 3/15
    re: new RegExp(`${B}${YEARLY}\\s*(음력\\s*)?(\\d{1,2})/(\\d{1,2})${E}`),
    resolve: (m) => yearly(+m[2], +m[3], !!m[1]),
  },
  {
    // 음력 날짜는 생신·제사처럼 해마다 챙기는 날이라 '음력'만 적어도 매년으로 본다
    re: new RegExp(`${B}음력\\s*(\\d{1,2})월\\s*(\\d{1,2})일(?:\\s*${YEARLY})?${E}`),
    resolve: (m) => yearly(+m[1], +m[2], true),
  },
  {
    re: new RegExp(`${B}음력\\s*(\\d{1,2})/(\\d{1,2})(?:\\s*${YEARLY})?${E}`),
    resolve: (m) => yearly(+m[1], +m[2], true),
  },
  {
    // '매년'만 있으면 같이 적은 날짜(없으면 오늘)의 월·일로 — 아래 parseQuickInput에서 채운다
    re: new RegExp(`${B}${YEARLY}${E}`),
    resolve: () => ({ freq: 'yearly', month: 0, day: 0 }),
  },
  { re: new RegExp(`${B}(?:매일|날마다)${E}`), resolve: () => ({ freq: 'daily' }) },
  {
    re: new RegExp(`${B}평일(?:마다)?${E}`),
    resolve: () => ({ freq: 'weekly', days: [1, 2, 3, 4, 5] }),
  },
  { re: new RegExp(`${B}주말(?:마다)?${E}`), resolve: () => ({ freq: 'weekly', days: [0, 6] }) },
  {
    // 매주 월요일, 매주 월수금, 매주 화목, 매주 금욜
    re: new RegExp(`${B}(?:매주|주마다)\\s*([${WEEKDAY}]{1,7})(?:요일|욜)?(?:마다)?${E}`),
    resolve: (m) => ({
      freq: 'weekly',
      days: [...new Set([...m[1]].map((c) => WEEKDAY.indexOf(c)))].sort(),
    }),
  },
  {
    // '매주'만 있으면 오늘 요일마다
    re: new RegExp(`${B}(?:매주|주마다)${E}`),
    resolve: (_m, today) => ({ freq: 'weekly', days: [fromISO(today).getDay()] }),
  },
  {
    re: new RegExp(`${B}(?:매월|매달|달마다)\\s*(\\d{1,2})일${E}`),
    resolve: (m) => (+m[1] >= 1 && +m[1] <= 31 ? { freq: 'monthly', day: +m[1] } : null),
  },
];

function cut(text: string, m: RegExpExecArray): string {
  return text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
}

export function parseQuickInput(input: string, today: string): Parsed {
  let text = ` ${input.trim()} `;
  let date: string | null = null;
  let time: string | null = null;
  let group: string | null = null;

  const g = GROUP_RE.exec(text);
  if (g) {
    group = g[1];
    text = cut(text, g);
  }

  let repeat: RepeatRule | null = null;
  for (const rule of REPEAT_RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    // 반복 표현이 보이면 거기서 멈춘다. '매년 2월 30일'처럼 없는 날짜면 반복 없이 글자 그대로 둔다
    // (뒤의 '매년'만 보는 규칙으로 넘어가 엉뚱한 날짜로 반복되지 않게).
    const resolved = rule.resolve(m, today);
    if (resolved) {
      repeat = resolved;
      text = cut(text, m);
    }
    break;
  }

  for (const rule of DATE_RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const resolved = rule.resolve(m, today);
    if (resolved) {
      date = resolved;
      text = cut(text, m);
      break;
    }
  }

  // '매년'만 적었으면 같이 적은 날짜(없으면 오늘)의 월·일로 매년
  if (repeat?.freq === 'yearly' && repeat.month === 0) {
    const base = fromISO(date ?? today);
    repeat = { freq: 'yearly', month: base.getMonth() + 1, day: base.getDate() };
    date = null;
  }

  // 반복이면 시작일(따로 적었으면 그 날, 아니면 오늘) 이후 첫 반복 날짜가 날짜가 된다
  if (repeat) date = firstDateFor(repeat, date ?? today);

  for (const rule of TIME_RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const resolved = rule.resolve(m);
    if (resolved) {
      time = resolved;
      text = cut(text, m);
      break;
    }
  }

  // 시간만 적으면 오늘로 본다
  if (time && !date) date = today;

  let title = text.replace(/\s+/g, ' ').trim();
  if (!title) title = input.trim();

  return { title, date, time, group, repeat };
}

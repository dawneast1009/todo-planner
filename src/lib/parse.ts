import { addDays, fromISO, makeDate, mondayOf, toISO } from './date';

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
  date: string | null;
  time: string | null;
  group: string | null;
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

  return { title, date, time, group };
}

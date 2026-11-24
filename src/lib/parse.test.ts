import { describe, expect, it } from 'vitest';
import { parseQuickInput } from './parse';

// 2026-11-24는 화요일
const TODAY = '2026-11-24';
const p = (s: string) => parseQuickInput(s, TODAY);

describe('parseQuickInput', () => {
  it('날짜가 없으면 언젠가 할 일', () => {
    expect(p('우유 사기')).toEqual({ title: '우유 사기', date: null, time: null, group: null, repeat: null });
  });

  it('오늘·내일·모레·글피', () => {
    expect(p('오늘 빨래').date).toBe('2026-11-24');
    expect(p('내일 치과').date).toBe('2026-11-25');
    expect(p('낼 치과').date).toBe('2026-11-25');
    expect(p('모레 시험').date).toBe('2026-11-26');
    expect(p('글피 시험').date).toBe('2026-11-27');
    expect(p('내일 치과').title).toBe('치과');
  });

  it('단어 안에 든 날짜 표현은 건드리지 않는다', () => {
    expect(p('편지 보낼 곳 정리')).toMatchObject({ date: null, title: '편지 보낼 곳 정리' });
    expect(p('오늘의집 장바구니')).toMatchObject({ date: null });
  });

  it('요일: 오늘 포함 가장 가까운 그 요일', () => {
    expect(p('화요일 학원').date).toBe('2026-11-24');
    expect(p('금요일 학원').date).toBe('2026-11-27');
    expect(p('월요일 학원').date).toBe('2026-11-30');
    expect(p('금욜 학원').date).toBe('2026-11-27');
  });

  it('이번주·다음주 요일 (월요일 시작)', () => {
    expect(p('이번주 월요일 회의').date).toBe('2026-11-23');
    expect(p('이번 주 일요일 회의').date).toBe('2026-11-29');
    expect(p('다음주 월요일 회의').date).toBe('2026-11-30');
    expect(p('다음 주 금요일 회의').date).toBe('2026-12-04');
    expect(p('담주 수요일 회의').date).toBe('2026-12-02');
    expect(p('다다음주 월요일 회의').date).toBe('2026-12-07');
    expect(p('다음주월요일 회의').title).toBe('회의');
  });

  it('까지·에 같은 조사는 함께 지운다', () => {
    expect(p('금요일까지 수학 과제')).toMatchObject({ date: '2026-11-27', title: '수학 과제' });
    expect(p('내일에 은행')).toMatchObject({ date: '2026-11-25', title: '은행' });
  });

  it('월/일 형식, 지난 날짜면 내년', () => {
    expect(p('12/5 영어 발표')).toMatchObject({ date: '2026-12-05', title: '영어 발표' });
    expect(p('12월 5일 영어 발표').date).toBe('2026-12-05');
    expect(p('12월5일 영어 발표').date).toBe('2026-12-05');
    expect(p('3/2 개학').date).toBe('2027-03-02');
    expect(p('11/24 오늘').date).toBe('2026-11-24');
  });

  it('없는 날짜는 날짜로 보지 않는다', () => {
    expect(p('2/30 이상한 날').date).toBeNull();
    expect(p('13/1 이상한 날').date).toBeNull();
  });

  it('연-월-일 형식', () => {
    expect(p('2027-01-03 여행').date).toBe('2027-01-03');
    expect(p('2027.1.3 여행').date).toBe('2027-01-03');
  });

  it('며칠 뒤 · 몇 주 뒤', () => {
    expect(p('3일 뒤 택배').date).toBe('2026-11-27');
    expect(p('2주 후 상담').date).toBe('2026-12-08');
  });

  it('일만 적으면 이번 달, 지났으면 다음 달', () => {
    expect(p('30일 마감').date).toBe('2026-11-30');
    expect(p('5일 마감').date).toBe('2026-12-05');
    expect(p('24일 마감').date).toBe('2026-11-24');
  });

  it('시간: 오전/오후가 없으면 1~6시는 오후', () => {
    expect(p('내일 3시 치과')).toMatchObject({ date: '2026-11-25', time: '15:00', title: '치과' });
    expect(p('내일 9시 치과').time).toBe('09:00');
    expect(p('내일 오전 3시 비행기').time).toBe('03:00');
    expect(p('내일 오후 9시 통화').time).toBe('21:00');
    expect(p('저녁 7시 저녁 약속').time).toBe('19:00');
    expect(p('오전 12시 자정').time).toBe('00:00');
    expect(p('낮 12시 점심').time).toBe('12:00');
  });

  it('분·반', () => {
    expect(p('내일 3시 반 학원').time).toBe('15:30');
    expect(p('내일 3시 15분 학원').time).toBe('15:15');
    expect(p('내일 15:40 학원').time).toBe('15:40');
    expect(p('내일 09:05 학원').time).toBe('09:05');
    expect(p('내일 3:30 학원').time).toBe('15:30');
  });

  it('시간만 적으면 오늘', () => {
    expect(p('4시 반 상담')).toMatchObject({ date: TODAY, time: '16:30', title: '상담' });
  });

  it('시간이 아닌 숫자+시는 건드리지 않는다', () => {
    expect(p('2시간 공부')).toMatchObject({ time: null, date: null, title: '2시간 공부' });
    expect(p('수학 3단원 풀기')).toMatchObject({ time: null, date: null });
  });

  it('#그룹', () => {
    expect(p('12/5 영어 발표 #수행평가')).toMatchObject({
      date: '2026-12-05',
      title: '영어 발표',
      group: '수행평가',
    });
    expect(p('#수행평가 국어 보고서')).toMatchObject({ group: '수행평가', title: '국어 보고서' });
  });

  it('제목이 남지 않으면 원문을 제목으로', () => {
    expect(p('내일')).toMatchObject({ title: '내일', date: '2026-11-25' });
  });
});

describe('반복', () => {
  it('매일: 오늘부터', () => {
    expect(p('매일 영어 단어')).toMatchObject({ repeat: { freq: 'daily' }, date: TODAY, title: '영어 단어' });
  });

  it('매주 요일들: 첫 날짜는 오늘 이후 가장 가까운 그 요일', () => {
    // 오늘은 화요일
    expect(p('매주 월수금 4시 학원')).toMatchObject({
      repeat: { freq: 'weekly', days: [1, 3, 5] },
      date: '2026-11-25',
      time: '16:00',
      title: '학원',
    });
    expect(p('매주 월요일 학원')).toMatchObject({ repeat: { freq: 'weekly', days: [1] }, date: '2026-11-30' });
    expect(p('매주 화 학원').date).toBe(TODAY);
  });

  it('평일·주말·매주', () => {
    expect(p('평일 아침 운동').repeat).toEqual({ freq: 'weekly', days: [1, 2, 3, 4, 5] });
    expect(p('주말 청소')).toMatchObject({ repeat: { freq: 'weekly', days: [0, 6] }, date: '2026-11-28' });
    expect(p('매주 분리수거').repeat).toEqual({ freq: 'weekly', days: [2] });
  });

  it('매월 며칠', () => {
    expect(p('매월 25일 용돈 정리')).toMatchObject({ repeat: { freq: 'monthly', day: 25 }, date: '2026-11-25' });
    expect(p('매달 1일 계획 세우기').date).toBe('2026-12-01');
  });

  it('반복 시작일을 따로 적으면 그 날부터', () => {
    expect(p('12/1 매일 스트레칭')).toMatchObject({ repeat: { freq: 'daily' }, date: '2026-12-01' });
  });

  it('반복이 아닌 말은 건드리지 않는다', () => {
    expect(p('매일유업 우유').repeat).toBeNull();
  });
});

describe('매년·음력', () => {
  it('매년 양력', () => {
    expect(p('매년 12월 25일 크리스마스')).toMatchObject({
      repeat: { freq: 'yearly', month: 12, day: 25 },
      date: '2026-12-25',
      title: '크리스마스',
    });
    expect(p('매년 3/2 개학기념').date).toBe('2027-03-02');
    expect(p('12/25 매년 크리스마스')).toMatchObject({ repeat: { freq: 'yearly', month: 12, day: 25 }, date: '2026-12-25' });
    expect(p('매년 결혼기념일').repeat).toEqual({ freq: 'yearly', month: 11, day: 24 });
  });

  it('음력은 매년으로 보고, 올해(또는 내년) 양력 날짜를 찾는다', () => {
    // 2026년 음력 8월 15일(추석) = 양력 9월 25일은 이미 지났으니 2027년 추석
    const chuseok = p('음력 8월 15일 추석');
    expect(chuseok.repeat).toEqual({ freq: 'yearly', month: 8, day: 15, lunar: true });
    expect(chuseok.date).toBe('2027-09-15');
    expect(p('매년 음력 1/1 설날')).toMatchObject({ date: '2027-02-07', title: '설날' });
    expect(p('음력 3/15 매년 엄마 생신').title).toBe('엄마 생신');
  });

  it('없는 날짜는 반복으로 보지 않는다', () => {
    expect(p('매년 2월 30일 이상한 날').repeat?.freq).not.toBe('yearly');
    expect(p('음력 13월 1일 이상').repeat).toBeNull();
  });
});

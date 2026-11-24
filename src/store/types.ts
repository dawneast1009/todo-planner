/** 할 일은 체크하고, 못 하면 다음 날로 넘어간다. 일정(약속)은 그 날에만 보인다. */
export type ItemKind = 'todo' | 'event';

export interface Item {
  id: string;
  title: string;
  memo: string;
  /** 'YYYY-MM-DD'. 없으면 '언젠가 할 일' */
  date: string | null;
  /** 'HH:mm' */
  time: string | null;
  kind: ItemKind;
  done: boolean;
  /** 체크한 날짜. 체크한 날 하루 동안은 목록에 줄 그어 남겨둔다. */
  doneOn: string | null;
  /** 켜면 '오늘' 화면 위쪽에 D-day가 뜬다 */
  important: boolean;
  groupId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: string;
  name: string;
  createdAt: number;
}

export interface SchoolConfig {
  officeCode: string;
  schoolCode: string;
  schoolName: string;
  grade: string;
  className: string;
}

export interface Settings {
  school: SchoolConfig | null;
  /** 나이스 인증키(선택). 레포가 아니라 사용자 데이터에만 저장된다. */
  neisKey: string;
  /** D-day를 켠 학사일정 키 목록 ('YYYY-MM-DD|행사명') */
  importantSchoolEvents: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  school: null,
  neisKey: '',
  importantSchoolEvents: [],
};

export interface Snapshot {
  ready: boolean;
  items: Item[];
  groups: Group[];
  settings: Settings;
}

export interface Store {
  /** 'local' 이면 이 기기에만 저장, 'cloud' 면 계정으로 동기화 */
  readonly mode: 'local' | 'cloud';
  subscribe(cb: (s: Snapshot) => void): () => void;
  putItem(item: Item): void;
  removeItem(id: string): void;
  putGroup(group: Group): void;
  /** 그룹을 지우면 그 그룹에 있던 항목은 그룹 없음으로 바뀐다 */
  removeGroup(id: string): void;
  putSettings(settings: Settings): void;
}

export function newId(): string {
  return crypto.randomUUID();
}

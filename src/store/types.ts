/** 할 일은 체크하고, 못 하면 다음 날로 넘어간다. 일정(약속)은 그 날에만 보인다. */
export type ItemKind = 'todo' | 'event';

/**
 * 반복 규칙. 시작 날짜는 Item.date.
 * weekly.days: 0=일 … 6=토, monthly.day: 1~31 (그 달에 없으면 그 달은 건너뜀)
 */
export type RepeatRule = { freq: 'daily' } | { freq: 'weekly'; days: number[] } | { freq: 'monthly'; day: number };

/** 첨부 파일 정보. 내용은 따로 조각내서 저장한다 (FileStore). */
export interface Attachment {
  id: string;
  name: string;
  /** 'image/jpeg', 'application/pdf' 등 */
  type: string;
  /** 바이트 */
  size: number;
  createdAt: number;
}

/** 첨부 파일 내용 저장소. 로그인(클라우드) 모드에서만 있다. */
export interface FileStore {
  /** 파일을 올리고 첨부 정보를 돌려준다. 인터넷이 필요하다. */
  upload(file: Blob, name: string): Promise<Attachment>;
  read(att: Attachment): Promise<Blob>;
  /**
   * 어떤 항목에도 안 붙어 있는 오래된 파일을 지운다. 지운 개수를 돌려준다.
   * 쓰는 파일 목록은 기기 캐시가 아니라 서버에서 새로 읽어서 판단한다 (캐시가 옛날 것이면 쓰는 파일을 지울 수 있어서).
   */
  cleanup(): Promise<number>;
}

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
  /** 반복 항목이면 규칙이 있다. 예전 데이터에는 이 필드가 없을 수 있다. */
  repeat?: RepeatRule | null;
  /** 반복 항목에서 체크한 날짜들 */
  doneDates?: string[];
  /** 반복 항목에서 '이 날만 삭제'한 날짜들 */
  skipDates?: string[];
  /** 화면용으로 펼친 반복 항목 하나에만 있다 (저장되지 않음). 원래 반복 항목의 id. */
  seriesId?: string;
  /** 첨부한 사진·PDF */
  attachments?: Attachment[];
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

export interface NotifySettings {
  /** 아침 요약 시각 'HH:mm'. 빈 문자열이면 끔 */
  morning: string;
  /** 시간 있는 항목을 몇 분 전에 알릴지. 0이면 끔 */
  eventLead: number;
}

export const DEFAULT_NOTIFY: NotifySettings = { morning: '07:30', eventLead: 30 };

export interface Settings {
  school: SchoolConfig | null;
  /** 알림 설정 (예전 데이터에는 없을 수 있다) */
  notify?: NotifySettings;
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

/** ok: 서버와 맞음, pending: 올리는 중, offline: 인터넷 없음(기기에만 저장됨) */
export type SyncState = 'ok' | 'pending' | 'offline';

export interface Snapshot {
  ready: boolean;
  sync: SyncState;
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
  /** 백업 복원: 할 일과 그룹을 통째로 바꾼다 (설정은 그대로) */
  replaceAll(items: Item[], groups: Group[]): Promise<void>;
  /** 첨부 파일 저장소 (로컬 모드에는 없다) */
  readonly files?: FileStore;
}

export function newId(): string {
  return crypto.randomUUID();
}

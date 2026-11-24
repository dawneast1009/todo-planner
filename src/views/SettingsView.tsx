import { useState } from 'react';
import { useApp } from '../context';
import { searchSchools, type SchoolInfo } from '../lib/neis';
import type { SchoolConfig } from '../store/types';

export function SettingsView({ account }: { account: React.ReactNode }) {
  return (
    <>
      <header className="view-head">
        <h1>설정</h1>
      </header>
      <section className="card">
        <h2>계정</h2>
        {account}
      </section>
      <SchoolSettings />
      <NeisKeySettings />
      <ExportData />
      <section className="card">
        <h2>폰에 앱처럼 설치</h2>
        <p className="hint">
          아이폰: Safari 공유 버튼 → 홈 화면에 추가
          <br />
          안드로이드: Chrome 메뉴(⋮) → 홈 화면에 추가 / 앱 설치
        </p>
      </section>
    </>
  );
}

function SchoolSettings() {
  const { settings, store } = useApp();
  const current = settings.school;
  const [editing, setEditing] = useState(!current);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SchoolInfo[] | null>(null);
  const [picked, setPicked] = useState<SchoolInfo | null>(null);
  const [grade, setGrade] = useState(current?.grade ?? '1');
  const [className, setClassName] = useState(current?.className ?? '1');
  const [status, setStatus] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus('찾는 중…');
    setResults(null);
    try {
      const r = await searchSchools(query.trim(), settings.neisKey);
      setResults(r.schools);
      setStatus(
        r.schools.length === 0
          ? '검색 결과가 없어요.'
          : r.partial
            ? '결과가 많아 5개만 보여요. 학교 이름을 더 정확히 적어보세요.'
            : null,
      );
    } catch (err) {
      setStatus(`검색 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const save = () => {
    const base = picked
      ? { officeCode: picked.officeCode, schoolCode: picked.schoolCode, schoolName: picked.schoolName }
      : current;
    if (!base) return;
    const school: SchoolConfig = {
      officeCode: base.officeCode,
      schoolCode: base.schoolCode,
      schoolName: base.schoolName,
      grade,
      className: className.trim() || '1',
    };
    store.putSettings({ ...settings, school });
    setEditing(false);
    setPicked(null);
    setResults(null);
    setQuery('');
  };

  if (!editing && current) {
    return (
      <section className="card">
        <h2>학교</h2>
        <p>
          {current.schoolName} {current.grade}학년 {current.className}반
        </p>
        <div className="btn-row">
          <button onClick={() => setEditing(true)}>바꾸기</button>
          <button
            className="danger"
            onClick={() => {
              if (confirm('학교 설정을 지울까요? 시간표와 학사일정이 더 이상 안 보여요.'))
                store.putSettings({ ...settings, school: null });
            }}
          >
            지우기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>학교</h2>
      <p className="hint">한 번 설정하면 시간표와 학사일정이 자동으로 떠요. (나이스 공개 자료, 보기 전용)</p>
      {!picked && (
        <form className="inline-form" onSubmit={search}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="학교 이름 (예: 한국고)"
            aria-label="학교 이름"
          />
          <button type="submit">검색</button>
        </form>
      )}
      {status && <p className="hint">{status}</p>}
      {!picked && results && results.length > 0 && (
        <ul className="pick-list">
          {results.map((s) => (
            <li key={`${s.officeCode}-${s.schoolCode}`}>
              <button onClick={() => setPicked(s)}>
                <strong>{s.schoolName}</strong>
                <span className="muted">{s.address || s.officeName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(picked || current) && (
        <>
          <p>
            <strong>{picked?.schoolName ?? current?.schoolName}</strong>
            {picked && (
              <button className="ghost small" onClick={() => setPicked(null)}>
                다시 검색
              </button>
            )}
          </p>
          <div className="field-row">
            <label>
              학년
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                {['1', '2', '3'].map((g) => (
                  <option key={g} value={g}>
                    {g}학년
                  </option>
                ))}
              </select>
            </label>
            <label>
              반
              <input
                inputMode="numeric"
                value={className}
                onChange={(e) => setClassName(e.target.value.replace(/\D/g, ''))}
              />
            </label>
          </div>
          <div className="btn-row">
            {current && (
              <button
                onClick={() => {
                  setEditing(false);
                  setPicked(null);
                }}
              >
                취소
              </button>
            )}
            <button className="primary" onClick={save}>
              저장
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function NeisKeySettings() {
  const { settings, store } = useApp();
  const [key, setKey] = useState(settings.neisKey);
  const changed = key.trim() !== settings.neisKey;
  return (
    <section className="card">
      <h2>나이스 인증키 (선택)</h2>
      <p className="hint">
        키가 없으면 나이스가 한 번에 5건까지만 줘서 시간표가 5교시까지만, 학사일정은 일부만 보여요.{' '}
        <a href="https://open.neis.go.kr" target="_blank" rel="noreferrer">
          나이스 교육정보 개방 포털
        </a>
        에 가입하고 인증키를 무료로 발급받아 넣으세요. 키는 내 계정 데이터에만 저장돼요.
      </p>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          store.putSettings({ ...settings, neisKey: key.trim() });
        }}
      >
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="인증키"
          aria-label="나이스 인증키"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={!changed}>
          저장
        </button>
      </form>
    </section>
  );
}

function ExportData() {
  const { items, groups } = useApp();
  const download = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items, groups }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="card">
      <h2>백업</h2>
      <p className="hint">할 일 {items.length}개, 그룹 {groups.length}개</p>
      <button onClick={download}>JSON 파일로 내보내기</button>
    </section>
  );
}

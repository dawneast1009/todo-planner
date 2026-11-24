import { useState } from 'react';
import { useApp } from '../context';
import { newId } from '../store/types';

/** 설정 화면의 그룹 관리: 추가·이름 바꾸기·삭제 */
export function GroupSettings() {
  const { groups, items, store } = useApp();
  const [name, setName] = useState('');
  const sorted = groups.slice().sort((a, b) => a.createdAt - b.createdAt);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/^#/, '');
    if (!n) return;
    if (!groups.some((g) => g.name.toLowerCase() === n.toLowerCase())) {
      store.putGroup({ id: newId(), name: n, createdAt: Date.now() });
    }
    setName('');
  };

  return (
    <section className="card">
      <h2>그룹</h2>
      <p className="hint">할 일을 적을 때 #그룹이름 을 붙여도 그룹이 생겨요. 메인 화면 위쪽 칩으로 그룹별로 볼 수 있어요.</p>
      <form className="inline-form" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 그룹 이름 (예: 수행평가)"
          aria-label="새 그룹 이름"
          enterKeyHint="done"
        />
        <button type="submit" disabled={!name.trim()}>
          추가
        </button>
      </form>
      {sorted.length > 0 && (
        <ul className="group-manage">
          {sorted.map((g) => {
            const count = items.filter((i) => i.groupId === g.id && !i.done).length;
            return (
              <li key={g.id}>
                <span className="group-name">
                  #{g.name} <span className="muted">{count}</span>
                </span>
                <button
                  className="ghost small"
                  onClick={() => {
                    const next = prompt('그룹 이름', g.name)?.trim().replace(/^#/, '');
                    if (next && next !== g.name) store.putGroup({ ...g, name: next });
                  }}
                >
                  이름 바꾸기
                </button>
                <button
                  className="ghost small danger"
                  onClick={() => {
                    if (confirm(`'${g.name}' 그룹을 지울까요? 항목은 지워지지 않고 그룹만 빠져요.`)) store.removeGroup(g.id);
                  }}
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

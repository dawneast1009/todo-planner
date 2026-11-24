import { useState } from 'react';
import { useApp } from '../context';
import { ItemList } from '../components/ItemRow';
import { QuickAdd } from '../components/QuickAdd';
import { groupView } from '../lib/views';
import { newId } from '../store/types';

export function GroupsView() {
  const { groups, items, today, store } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const open = groups.find((g) => g.id === openId);

  if (open) {
    const list = groupView(items, open.id, today);
    return (
      <>
        <header className="view-head">
          <button className="ghost" onClick={() => setOpenId(null)} aria-label="그룹 목록으로">
            ‹
          </button>
          <h1>#{open.name}</h1>
          <button
            className="ghost small"
            onClick={() => {
              const next = prompt('그룹 이름', open.name)?.trim();
              if (next && next !== open.name) store.putGroup({ ...open, name: next });
            }}
          >
            이름 바꾸기
          </button>
          <button
            className="ghost small danger"
            onClick={() => {
              if (confirm(`'${open.name}' 그룹을 지울까요? 항목은 지워지지 않고 그룹만 빠져요.`)) {
                store.removeGroup(open.id);
                setOpenId(null);
              }
            }}
          >
            삭제
          </button>
        </header>
        <QuickAdd groupId={open.id} placeholder={`#${open.name}에 추가`} />
        <ItemList items={list} showDate hideGroup />
        {list.length === 0 && <p className="empty">이 그룹에 남은 항목이 없어요.</p>}
      </>
    );
  }

  const sorted = groups.slice().sort((a, b) => a.createdAt - b.createdAt);
  const addGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/^#/, '');
    if (!n) return;
    if (!groups.some((g) => g.name.toLowerCase() === n.toLowerCase())) {
      store.putGroup({ id: newId(), name: n, createdAt: Date.now() });
    }
    setName('');
  };

  return (
    <>
      <header className="view-head">
        <h1>그룹</h1>
      </header>
      <form className="quick-add" onSubmit={addGroup}>
        <div className="quick-add-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="새 그룹 이름 (예: 수행평가)"
            aria-label="새 그룹 이름"
            enterKeyHint="done"
          />
          <button type="submit" className="add-btn" disabled={!name.trim()} aria-label="그룹 추가">
            +
          </button>
        </div>
      </form>
      <p className="hint">할 일을 적을 때 끝에 #그룹이름 을 붙여도 그룹에 들어가요.</p>
      <ul className="group-list">
        {sorted.map((g) => {
          const count = items.filter((i) => i.groupId === g.id && !i.done).length;
          return (
            <li key={g.id}>
              <button onClick={() => setOpenId(g.id)}>
                <span>#{g.name}</span>
                <span className="muted">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {sorted.length === 0 && <p className="empty">아직 그룹이 없어요.</p>}
    </>
  );
}

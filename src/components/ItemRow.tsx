import { useApp } from '../context';
import { relativeLabel, timeLabel } from '../lib/date';
import type { Item } from '../store/types';

interface Props {
  item: Item;
  /** 날짜도 같이 보여줄지 */
  showDate?: boolean;
  /** 밀린 할 일: '11/22 (일)부터' 처럼 보여준다 */
  carried?: boolean;
  hideGroup?: boolean;
}

export function ItemRow({ item, showDate, carried, hideGroup }: Props) {
  const { today, toggleDone, openItem, groupName } = useApp();
  const group = hideGroup ? null : groupName(item.groupId);
  const isEvent = item.kind === 'event';
  const memoLine = item.memo.trim().split('\n')[0];
  const hasMeta = (carried && item.date) || (showDate && item.date) || group;

  return (
    <li className={`row${item.done ? ' done' : ''}${isEvent ? ' event' : ''}`}>
      {/* 일정은 동그라미, 할 일은 네모 체크 */}
      <button
        className={`check${isEvent ? ' event-check' : ''}`}
        onClick={() => toggleDone(item)}
        aria-label={`${item.title} ${item.done ? '완료 취소' : '완료'}`}
      >
        {item.done ? '✓' : ''}
      </button>
      <button className="row-main" onClick={() => openItem(item)}>
        <span className="row-text">
          <span className="row-title">
            {item.important && (
              <span className="star" aria-label="중요">
                ★{' '}
              </span>
            )}
            {item.title}
          </span>
          {memoLine && <span className="row-memo">{memoLine}</span>}
          {hasMeta && (
            <span className="row-meta">
              {carried && item.date && <span className="meta-carried">{relativeLabel(item.date, today)}부터</span>}
              {showDate && !carried && item.date && <span>{relativeLabel(item.date, today)}</span>}
              {group && <span className="meta-group">#{group}</span>}
            </span>
          )}
        </span>
        {item.time && <span className="row-time">{timeLabel(item.time)}</span>}
      </button>
    </li>
  );
}

export function ItemList({ items, ...rest }: { items: Item[] } & Omit<Props, 'item'>) {
  if (items.length === 0) return null;
  return (
    <ul className="list">
      {items.map((it) => (
        <ItemRow key={it.id} item={it} {...rest} />
      ))}
    </ul>
  );
}

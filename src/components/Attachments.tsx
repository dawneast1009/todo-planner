import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context';
import { AttachError, formatSize, isImage, prepareFile } from '../lib/attach';
import type { Attachment } from '../store/types';

// 같은 파일을 여러 번 받지 않게 이 화면이 떠 있는 동안 기억해 둔다
const urlCache = new Map<string, string>();

/** 편집 창의 첨부 목록. 붙이기·보기·빼기. 바뀐 목록은 onChange로 올려서 편집 창이 저장한다. */
export function Attachments({
  attachments,
  onChange,
}: {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
}) {
  const { store } = useApp();
  const files = store.files;
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ url: string; name: string } | null>(null);

  if (!files) {
    return <p className="hint">사진·PDF 첨부는 로그인해서 쓸 때만 돼요.</p>;
  }

  const urlFor = async (att: Attachment) => {
    const cached = urlCache.get(att.id);
    if (cached) return cached;
    const url = URL.createObjectURL(await files.read(att));
    urlCache.set(att.id, url);
    return url;
  };

  const add = async (list: FileList) => {
    setBusy(true);
    setStatus(null);
    const added: Attachment[] = [];
    const errors: string[] = [];
    const picked = [...list];
    for (const [i, f] of picked.entries()) {
      setStatus({ text: `올리는 중… ${picked.length > 1 ? `(${i + 1}/${picked.length}) ` : ''}${f.name}` });
      try {
        const { blob, name } = await prepareFile(f);
        added.push(await files.upload(blob, name));
      } catch (e) {
        errors.push(`${f.name}: ${e instanceof AttachError || e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (added.length) onChange([...attachments, ...added]);
    setStatus(errors.length ? { text: errors.join('\n'), error: true } : null);
    setBusy(false);
  };

  const open = async (att: Attachment) => {
    setStatus({ text: '여는 중…' });
    try {
      const url = await urlFor(att);
      setStatus(null);
      if (isImage(att.type)) {
        setViewing({ url, name: att.name });
        return;
      }
      // PDF: PC는 새 탭의 PDF 보기로, 폰은 내려받아 PDF 앱으로 연다
      const touch = window.matchMedia('(pointer: coarse)').matches;
      if (!touch && window.open(url, '_blank')) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name;
      a.click();
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  };

  return (
    <div className="attachments">
      {attachments.length > 0 && (
        <ul className="attach-list">
          {attachments.map((att) => (
            <li key={att.id}>
              <button type="button" className="attach-open" onClick={() => void open(att)}>
                {isImage(att.type) ? <Thumb att={att} urlFor={urlFor} /> : <span className="attach-icon">PDF</span>}
                <span className="attach-name">{att.name}</span>
                <span className="attach-size">{formatSize(att.size)}</span>
              </button>
              <button
                type="button"
                className="ghost attach-remove"
                aria-label={`${att.name} 빼기`}
                onClick={() => onChange(attachments.filter((a) => a.id !== att.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="attach-add" disabled={busy} onClick={() => inputRef.current?.click()}>
        📎 사진·PDF 붙이기
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          const list = e.target.files;
          if (list && list.length) void add(list);
          e.target.value = '';
        }}
      />
      {status && <p className={status.error ? 'error pre-line' : 'hint'}>{status.text}</p>}
      {viewing && (
        <div className="viewer" role="dialog" aria-label={viewing.name} onClick={() => setViewing(null)}>
          <img src={viewing.url} alt={viewing.name} />
          <button type="button" className="viewer-close" aria-label="닫기">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/** 사진 미리보기 (작게) */
function Thumb({ att, urlFor }: { att: Attachment; urlFor: (a: Attachment) => Promise<string> }) {
  const [url, setUrl] = useState<string | null>(urlCache.get(att.id) ?? null);
  useEffect(() => {
    if (url) return;
    let alive = true;
    urlFor(att)
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.id]);
  return url ? <img className="attach-thumb" src={url} alt="" /> : <span className="attach-icon">사진</span>;
}

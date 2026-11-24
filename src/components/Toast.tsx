import { useEffect } from 'react';

export interface ToastState {
  id: number;
  text: string;
  undo?: () => void;
}

/** 아래에 잠깐 뜨는 알림. '되돌리기'를 누르면 방금 한 일을 취소한다. */
export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span className="toast-text">{toast.text}</span>
      {toast.undo && (
        <button
          className="toast-undo"
          onClick={() => {
            toast.undo!();
            onClose();
          }}
        >
          되돌리기
        </button>
      )}
    </div>
  );
}

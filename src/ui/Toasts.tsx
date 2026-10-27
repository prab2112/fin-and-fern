import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from './storeContext';

const TOAST_MS = 3500;

export function Toasts() {
  const toasts = useGame(useShallow((s) => s.toasts));
  const dismiss = useGame((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    if (!oldest) return;
    const t = setTimeout(() => dismiss(oldest.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast ${t.tone}`}
          onClick={() => dismiss(t.id)}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

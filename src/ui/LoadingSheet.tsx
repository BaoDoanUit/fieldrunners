import { useEffect, useState } from "react";

/**
 * LoadingSheet — a folded-sheet overlay shown for the first ~600 ms
 * after `main.tsx` mount, while Vite chunks arrive.
 *
 * Implementation:
 *  - On mount, schedules removal after 600 ms.
 *  - Uses a CSS class `is-leaving` to play the reverse sheet-rise
 *    animation before unmounting.
 *  - Respects `prefers-reduced-motion` via CSS.
 */
export function LoadingSheet() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Wait for first paint, then start the leave animation.
    const raf = requestAnimationFrame(() => {
      const leaveTimer = window.setTimeout(() => setLeaving(true), 600);
      const goneTimer = window.setTimeout(() => setGone(true), 880);
      return () => {
        window.clearTimeout(leaveTimer);
        window.clearTimeout(goneTimer);
      };
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (gone) return null;

  return (
    <div className={`loading-sheet ${leaving ? "is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="loading-sheet__card">
        <span className="corner-tr" aria-hidden />
        <span className="corner-bl" aria-hidden />
        <span className="stamp">BINDING THE MANUAL…</span>
        <p className="loading-sheet__title">FieldRunner Defense</p>
        <div className="loading-sheet__dots" aria-hidden>
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

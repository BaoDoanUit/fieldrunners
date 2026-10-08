import { useEffect, useRef, type ReactNode } from "react";

/**
 * The signature "cardstock sheet" overlay of the Tactical Field Manual
 * design system: a folded paper page laid over the battlefield, with
 * double-ruled border, mechanical-drafting corner brackets, a stamped
 * eyebrow, and a small folio page number.
 *
 * Every modal/screen in the game uses this component (Tutorial, Victory,
 * Defeat, Settings, Pause, RoundComplete, SoldConfirm, Home).
 *
 * Behaviour:
 *  - `aria-modal="true"` + `role="dialog"` + `aria-labelledby` on the title.
 *  - `Escape` calls `onClose` (when provided) — disabled when `dismissible={false}`.
 *  - Focus trap: first focusable element inside the sheet is focused on open,
 *    Tab/Shift+Tab cycle within the sheet.
 *  - Body scroll is locked while the sheet is open.
 *  - Plays the "sheet-rise" CSS animation on mount.
 *  - Calls `onMount` once after the first paint (useful for SFX cues).
 */
export type CardstockSheetProps = {
  title: string;
  stamp?: ReactNode;
  folio?: ReactNode;
  children?: ReactNode;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  onClose?: () => void;
  onMount?: () => void;
  dismissible?: boolean;
  size?: "narrow" | "wide";
};

export function CardstockSheet(props: CardstockSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const titleId = useRef(`sheet-title-${Math.random().toString(36).slice(2, 9)}`).current;

  // Focus + body lock + Escape + mount-callback
  useEffect(() => {
    props.onMount?.();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first focusable element inside the sheet
    const root = sheetRef.current;
    const firstFocusable = root?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.dismissible !== false) {
        e.preventDefault();
        props.onClose?.();
        return;
      }
      if (e.key === "Tab" && root) {
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // props.onMount / props.onClose / props.dismissible are captured on
    // mount; subsequent prop changes are intentionally ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => {
      // Click outside the sheet (on the dim backdrop) closes it.
      if (e.target === e.currentTarget && props.dismissible !== false) {
        props.onClose?.();
      }
    }}>
      <div
        ref={sheetRef}
        className={`overlay-card ${props.size === "wide" ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <span className="corner-tr" aria-hidden />
        <span className="corner-bl" aria-hidden />
        {props.stamp ? <span className="stamp">Field Manual · {props.stamp}</span> : null}
        <h2 id={titleId}>{props.title}</h2>
        {props.children}
        {props.actions && props.actions.length > 0 ? (
          <div className="button-grid">
            {props.actions.map((action) => (
              <button
                key={action.label}
                className={action.primary ? "primary" : ""}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        {props.folio ? <span className="folio">{props.folio}</span> : null}
      </div>
    </div>
  );
}

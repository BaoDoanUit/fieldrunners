import { useEffect, useState } from "react";
import { Sfx } from "../audio/Sfx";

/**
 * InstallHint — small cardstock strip that nudges iOS Safari users to
 * "Add to Home Screen" so they get a standalone PWA with no browser chrome.
 *
 * Detection:
 *  - iOS Safari only (not in standalone mode)
 *  - Shown at most once per device (gated by `localStorage`)
 *  - Dismiss button hides it for the rest of the session
 */
export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (dismissed) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const seen = localStorage.getItem("fieldrunner-install-hint-seen") === "1";

    if (isIOS && !isStandalone && !seen) {
      // Delay slightly so it doesn't compete with the loading sheet.
      const t = window.setTimeout(() => setVisible(true), 1500);
      return () => window.clearTimeout(t);
    }
  }, [dismissed]);

  if (!visible || dismissed) return null;

  const close = (mark = true) => {
    Sfx.play("ink-press");
    if (mark) localStorage.setItem("fieldrunner-install-hint-seen", "1");
    setDismissed(true);
  };

  return (
    <aside className="install-hint" role="note" aria-label="Install FieldRunner">
      <div className="install-hint__body">
        <span className="install-hint__stamp">Field Manual · Tip</span>
        <p>
          <strong>Install FieldRunner.</strong> Tap{" "}
          <span className="install-hint__kbd" aria-hidden>Share</span>{" "}
          then <em>Add to Home Screen</em> for a standalone build.
        </p>
      </div>
      <button
        className="install-hint__close"
        aria-label="Dismiss install hint"
        onClick={() => close(true)}
      >
        ×
      </button>
    </aside>
  );
}

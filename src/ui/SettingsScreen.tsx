import { useState } from "react";
import { CardstockSheet } from "./CardstockSheet";
import { Sfx } from "../audio/Sfx";
import { Haptics } from "../audio/Haptics";
import type { SavedProgress } from "../shared/gameTypes";

export type SettingsScreenProps = {
  progress: SavedProgress;
  reducedMotion: boolean;
  onChange: (next: Partial<SavedProgress>) => void;
  onResetProgress: () => void;
  onReducedMotionChange: (next: boolean) => void;
  onClose: () => void;
};

export function SettingsScreen(props: SettingsScreenProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { settings } = props.progress;

  const set = <K extends keyof typeof settings>(key: K, value: boolean) => {
    Sfx.unlock();
    Sfx.play("ink-press");
    props.onChange({ settings: { ...settings, [key]: value } });
    if (key === "sfx") Sfx.mute(!value);
    if (key === "haptics") Haptics.setEnabled(value);
  };

  const toggleReducedMotion = (next: boolean) => {
    Sfx.unlock();
    Sfx.play("ink-press");
    props.onReducedMotionChange(next);
  };

  return (
    <>
      <CardstockSheet
        title="Settings"
        stamp="Preferences"
        folio="P. 11 / 13"
        onClose={() => {
          Sfx.unlock();
          Sfx.play("ink-press");
          props.onClose();
        }}
        actions={[{ label: "Done", onClick: () => {
          Sfx.unlock();
          Sfx.play("ink-press");
          props.onClose();
        }, primary: true }]}
      >
        <p>
          Toggle each preference live — changes apply without reloading the run.
        </p>

        <div className="settings-grid">
          <ToggleRow
            label="Music"
            description="Looping background music (Phase 3.10 ships the track)."
            checked={settings.music}
            onChange={(v) => set("music", v)}
          />
          <ToggleRow
            label="SFX"
            description="Sheet rise, ink press, fire cues, victory sting."
            checked={settings.sfx}
            onChange={(v) => set("sfx", v)}
          />
          <ToggleRow
            label="Haptics"
            description="Vibration on tower placement (Android browsers only — iOS uses Capacitor in Phase 4)."
            checked={settings.haptics}
            onChange={(v) => set("haptics", v)}
          />
          <ToggleRow
            label="Reduced motion"
            description="Disable sheet-rise animation and in-canvas bursts when your device prefers it."
            checked={props.reducedMotion}
            onChange={toggleReducedMotion}
          />
        </div>

        <div className="settings-danger">
          <h3 className="eyebrow">Field Order</h3>
          <p className="detail-card muted">
            Reset all progress — unlocked round, best score, tutorial completion, settings.
            The server-side leaderboard is not affected.
          </p>
          <button onClick={() => setConfirmReset(true)}>Reset progress…</button>
        </div>
      </CardstockSheet>

      {confirmReset ? (
        <CardstockSheet
          title="Reset progress?"
          stamp="Confirm"
          folio="P. 12 / 13"
          onClose={() => setConfirmReset(false)}
          actions={[
            { label: "Yes, reset", onClick: () => {
              Sfx.play("ink-press");
              props.onResetProgress();
              setConfirmReset(false);
            }, primary: true },
            { label: "Cancel", onClick: () => setConfirmReset(false) }
          ]}
        >
          <p>This cannot be undone. Local saves, unlocked rounds, and best scores are cleared.</p>
        </CardstockSheet>
      ) : null}
    </>
  );
}

function ToggleRow(props: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span className="toggle-row__label">{props.label}</span>
      <span className="toggle-row__desc">{props.description}</span>
      <span className={`toggle ${props.checked ? "is-on" : ""}`} role="switch" aria-checked={props.checked}>
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          aria-label={props.label}
        />
        <span className="toggle__thumb" aria-hidden />
      </span>
    </label>
  );
}

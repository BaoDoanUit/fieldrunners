import { useState } from "react";
import { Sfx } from "../audio/Sfx";
import { MapPlate } from "./MapPlate";

export type HomeMenuProps = {
  bestScore: number;
  unlockedRound: number;
  tutorialComplete: boolean;
  onBegin: () => void;
  onContinue: () => void;
  onHowToPlay: () => void;
  onSettings: () => void;
};

/**
 * HomeMenu — the home screen of the game.
 *
 * In the Tactical Field Manual metaphor, this is the moment the
 * commander opens the manual on the desk. The 3D scene is hidden
 * behind this screen; only the printed topographical map is visible.
 */
export function HomeMenu(props: HomeMenuProps) {
  const [pressed, setPressed] = useState<string | null>(null);

  const tap = (key: string, action: () => void) => () => {
    Sfx.unlock();
    Sfx.play("ink-press");
    setPressed(key);
    setTimeout(() => setPressed(null), 120);
    action();
  };

  return (
    <main className="home-menu" role="main">
      <header className="home-menu__header">
        <span className="home-menu__stamp">Field Manual · Classified</span>
        <h1 className="home-menu__title">FieldRunner Defense</h1>
        <p className="home-menu__subtitle">
          Hold the bend through 20 handcrafted rounds. Build a fortress.
          Earn the win.
        </p>
      </header>

      <section className="home-menu__plate" aria-label="Topographical map">
        <MapPlate size="large" title="Topographical map of the 20-round path" />
      </section>

      <section className="home-menu__actions">
        <button
          className={`primary action-primary ${pressed === "begin" ? "is-pressed" : ""}`}
          onClick={tap("begin", props.onBegin)}
        >
          Begin Run
        </button>
        <button
          className={pressed === "continue" ? "is-pressed" : ""}
          onClick={tap("continue", props.onContinue)}
          disabled={!props.tutorialComplete || props.unlockedRound <= 1}
        >
          Continue Round {props.unlockedRound}
        </button>
        <button
          className={pressed === "tutorial" ? "is-pressed" : ""}
          onClick={tap("tutorial", props.onHowToPlay)}
        >
          {props.tutorialComplete ? "Review Briefing" : "Begin Briefing"}
        </button>
        <button
          className="link"
          onClick={tap("settings", props.onSettings)}
        >
          Settings
        </button>
      </section>

      <footer className="home-menu__footer">
        <span>
          Best <strong>{props.bestScore.toLocaleString()}</strong>
        </span>
        <span className="dot">·</span>
        <span>
          Cleared through <strong>Round {Math.max(1, props.unlockedRound - 1)}</strong>
        </span>
        <span className="dot">·</span>
        <span className="folio">P. 00 / 13</span>
      </footer>
    </main>
  );
}

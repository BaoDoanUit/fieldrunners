import { useState } from "react";
import { CardstockSheet } from "./CardstockSheet";
import { Sfx } from "../audio/Sfx";

export type TutorialStepId =
  | "welcome"
  | "path"
  | "zones"
  | "place"
  | "wave"
  | "wrap";

type Step = {
  id: TutorialStepId;
  stamp: string;
  folio: string;
  title: string;
  body: string;
  primary: string;
  /** "advance" auto-continues when the user does the right thing
   *  in the world (e.g. places a tower). The page stays up until
   *  that happens, but the primary CTA is hidden. */
  advanceOn?: "placement" | "wave_started";
};

const STEPS: Step[] = [
  {
    id: "welcome",
    stamp: "Briefing 00",
    folio: "P. 00 / 13",
    title: "Welcome, commander",
    body:
      "Twenty handcrafted rounds stand between you and the exit. The manual " +
      "is short. Read on, and you will know the rest on the field.",
    primary: "Continue"
  },
  {
    id: "path",
    stamp: "Briefing 01",
    folio: "P. 01 / 13",
    title: "The path",
    body:
      "Enemies enter here, walk this route, reach the exit. If ten of them " +
      "leak, the run is lost. The path does not change between rounds.",
    primary: "Show me the zones"
  },
  {
    id: "zones",
    stamp: "Briefing 02",
    folio: "P. 02 / 13",
    title: "Build zones",
    body:
      "Sixteen build zones are marked on the field. Pick a tower card, then " +
      "tap an open zone to place it. One tower per zone.",
    primary: "I will place a tower"
  },
  {
    id: "place",
    stamp: "Briefing 03",
    folio: "P. 03 / 13",
    title: "Place your first tower",
    body:
      "Tap a card at the bottom of the screen to select a tower. Then tap " +
      "any pulsing build zone to place it.",
    primary: "I did it",
    advanceOn: "placement"
  },
  {
    id: "wave",
    stamp: "Briefing 04",
    folio: "P. 04 / 13",
    title: "Start the wave",
    body:
      "Press Start Wave to begin. Combat is automatic. Towers acquire and " +
      "fire on their own; you can upgrade and sell during the fight.",
    primary: "I started the wave",
    advanceOn: "wave_started"
  },
  {
    id: "wrap",
    stamp: "Briefing 05",
    folio: "P. 05 / 13",
    title: "Upgrades and sells",
    body:
      "Tap an owned tower to inspect. Upgrades and sells are available " +
      "during combat. Spend wisely. Best of luck, commander.",
    primary: "Finish Tutorial"
  }
];

/**
 * TutorialFlow — six-step guided UX that replaces the one-line tutorial.
 *
 * Steps 0–2 are explicit (Continue). Steps 3–4 auto-advance when the
 * player performs the action (places a tower / starts a wave). Step 5
 * ends the tutorial. "Skip" is available on every step.
 */
export type TutorialFlowProps = {
  /** Called when the player advances to the next step (or auto-advances). */
  onStep?: (step: TutorialStepId) => void;
  /** Called when the player finishes step 5 ("Finish Tutorial"). */
  onFinish: () => void;
  /** Called when the player presses "Skip" on any step. */
  onSkip: () => void;
  /** Tell the flow that the world event it was waiting on happened. */
  onWorldEvent: (e: "placement" | "wave_started") => void;
  /** Current world event — incremented by the App when the action lands. */
  worldEventCount: { placement: number; wave_started: number };
  /** First step (in case the user backed out via Home and reopens). */
  startAt?: TutorialStepId;
};

export function TutorialFlow(props: TutorialFlowProps) {
  const [stepIdx, setStepIdx] = useState(() => {
    if (!props.startAt) return 0;
    const i = STEPS.findIndex((s) => s.id === props.startAt);
    return Math.max(0, i);
  });
  const step = STEPS[stepIdx];

  // Did the world event that this step was waiting on fire while we
  // were on it? If so, auto-advance.
  const waiting = step.advanceOn;
  const waitingFired = waiting
    ? (props.worldEventCount[waiting] > 0)
    : false;

  const advance = () => {
    Sfx.unlock();
    Sfx.play("sheet-rise");
    if (stepIdx >= STEPS.length - 1) {
      props.onFinish();
      return;
    }
    const next = STEPS[stepIdx + 1];
    setStepIdx(stepIdx + 1);
    props.onStep?.(next.id);
  };

  const skip = () => {
    Sfx.unlock();
    Sfx.play("ink-press");
    props.onSkip();
  };

  // If we were waiting and the world event fired, auto-advance on the
  // next render. The cardstock sheet stays up so the user sees feedback
  // — the sheet will swap to the next step on the same render.
  if (waitingFired && step.advanceOn) {
    // Defer to a microtask so we don't update state during render.
    queueMicrotask(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
      props.onStep?.(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)].id);
    });
  }

  return (
    <CardstockSheet
      stamp={step.stamp}
      folio={step.folio}
      title={step.title}
      onClose={skip}
      actions={
        waitingFired
          ? []
          : [{ label: step.primary, onClick: advance, primary: true }]
      }
    >
      <p>{step.body}</p>
      {waiting && !waitingFired ? (
        <p className="detail-card muted" style={{ marginTop: "10px" }}>
          {step.advanceOn === "placement"
            ? "Waiting for you to place a tower…"
            : "Waiting for you to start the wave…"}
        </p>
      ) : null}
      <button
        className="link"
        style={{
          marginTop: "8px",
          background: "transparent",
          border: 0,
          color: "var(--ink)",
          textDecoration: "underline",
          textUnderlineOffset: "4px",
          textTransform: "none",
          letterSpacing: 0,
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          padding: "6px"
        }}
        onClick={skip}
      >
        Skip the briefing
      </button>
    </CardstockSheet>
  );
}

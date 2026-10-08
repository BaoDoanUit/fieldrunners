import { CardstockSheet } from "./CardstockSheet";
import { Sfx } from "../audio/Sfx";

export type RoundCompleteSheetProps = {
  round: number;
  defeated: number;
  escaped: number;
  earned: number;
  score: number;
  isFinal?: boolean;
  onNext: () => void;
  onReview: () => void;
};

export function RoundCompleteSheet(props: RoundCompleteSheetProps) {
  const stamp = props.isFinal
    ? `Order ${props.round} · Cleared · All 20`
    : `Order ${props.round} · Cleared`;

  const total = props.defeated + props.escaped;
  const accuracy = total > 0 ? Math.round((props.defeated / total) * 100) : 100;

  const tap = (label: string, action: () => void) => () => {
    Sfx.unlock();
    Sfx.play("ink-press");
    action();
  };

  return (
    <CardstockSheet
      stamp={stamp}
      folio={`P. ${String(Math.min(props.round, 13)).padStart(2, "0")} / 13`}
      title={props.isFinal ? "Victory" : "Round cleared"}
      actions={[
        {
          label: props.isFinal ? "Restart Round 1" : `Begin Order ${props.round + 1}`,
          onClick: tap("next", props.onNext),
          primary: true
        },
        { label: "Review Field", onClick: tap("review", props.onReview) }
      ]}
    >
      <p>
        Order {props.round} cleared with <strong>{props.defeated}</strong>{" "}
        confirmed kills and <strong>{props.escaped}</strong> leaks. Accuracy:{" "}
        <strong>{accuracy}%</strong>.
      </p>
      <p>
        Bounty paid: <strong>¤{props.earned}</strong>. Running score:{" "}
        <strong>{props.score.toLocaleString()}</strong>.
      </p>
      {!props.isFinal && (props.round === 4 || props.round === 9 || props.round === 14) ? (
        <p className="detail-card" style={{ marginTop: "8px", color: "var(--flare)" }}>
          <strong>Promotion:</strong> a new tower is recommended in the field for the next order.
        </p>
      ) : null}
    </CardstockSheet>
  );
}

import { CardstockSheet } from "./CardstockSheet";
import { Sfx } from "../audio/Sfx";

export type PauseSheetProps = {
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
};

export function PauseSheet(props: PauseSheetProps) {
  const tap = (label: string, action: () => void) => () => {
    Sfx.unlock();
    Sfx.play("ink-press");
    action();
  };
  return (
    <CardstockSheet
      stamp="Halted"
      folio="P. 09 / 13"
      title="Paused"
      actions={[
        { label: "Resume", onClick: tap("resume", props.onResume), primary: true },
        { label: "Restart Round", onClick: tap("restart", props.onRestart) },
        { label: "Home", onClick: tap("home", props.onHome) }
      ]}
    >
      <p>Time waits for the commander. The battlefield is held.</p>
    </CardstockSheet>
  );
}

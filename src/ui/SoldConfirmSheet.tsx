import { CardstockSheet } from "./CardstockSheet";
import { Sfx } from "../audio/Sfx";

export type SoldConfirmSheetProps = {
  towerName: string;
  refund: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SoldConfirmSheet(props: SoldConfirmSheetProps) {
  const tap = (label: string, action: () => void) => () => {
    Sfx.unlock();
    Sfx.play("ink-press");
    action();
  };
  return (
    <CardstockSheet
      stamp="Field Order · Sell"
      folio="P. 06 / 13"
      title={`Sell ${props.towerName}?`}
      actions={[
        { label: `Confirm · +¤${props.refund}`, onClick: tap("confirm", props.onConfirm), primary: true },
        { label: "Cancel", onClick: tap("cancel", props.onCancel) }
      ]}
    >
      <p>
        Selling returns <strong>¤{props.refund}</strong> in bounty. The
        build zone is freed and your run is unchanged otherwise.
      </p>
    </CardstockSheet>
  );
}

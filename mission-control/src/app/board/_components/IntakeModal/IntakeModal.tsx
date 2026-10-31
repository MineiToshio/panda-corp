"use client";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Modal } from "@/components/core/Modal/Modal";
import { t } from "@/lib/copy/copy";
export interface IntakeModalProps {
  open: boolean;
  onClose: () => void;
}
const COMMANDS = [
  ["explore", "dialogs.captureIdeas.explore"],
  ["new-idea", "dialogs.captureIdeas.newIdea"],
  ["discover", "dialogs.captureIdeas.discover"],
  ["recommend", "dialogs.captureIdeas.recommend"],
] as const;
/** Copy-only entry points for capturing and refining ideas. */
export function IntakeModal({ open, onClose }: IntakeModalProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dialogs.captureIdeas.title")}
      kicker={t("dialogs.captureIdeas.kicker")}
      testIdBase="intake"
    >
      <p>{t("dialogs.captureIdeas.intro")}</p>
      {COMMANDS.map(([command, key]) => (
        <section key={command} data-testid={`intake-command-${command}`}>
          <h3>{t(key)}</h3>
          <CmdRow command={`/pandacorp:${command}`} variant="box" />
        </section>
      ))}
    </Modal>
  );
}

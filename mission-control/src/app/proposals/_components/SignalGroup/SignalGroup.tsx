import { CountPill } from "@/components/core/Chip/CountPill";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Icon } from "@/components/core/Icon/Icon";
import { t, tRich } from "@/lib/copy/copy";
import type { SignalGroupData } from "@/lib/proposals/signals";
import styles from "../ProposalsSummary/Proposals.module.css";
/** Native disclosure of automatic signals with explicit unreliable-signal copy. */
export function SignalGroup({
  group,
  skillCount,
}: {
  readonly group: SignalGroupData;
  readonly skillCount: number;
}): React.JSX.Element {
  const commandFor = (item: SignalGroupData["items"][number]): string =>
    item.kind === "recurring-lesson" && item.target
      ? `/pandacorp:learn ${item.target}`
      : item.command;
  const commands = new Set(group.items.map(commandFor));
  const first = group.items[0];
  const sharedCommand = commands.size === 1 && first ? commandFor(first) : null;
  const note =
    group.kind === "unused"
      ? group.unreliable
        ? tRich("propuestas.signals.unused.noteNoisy", {
            unused: group.items.length,
            skills: skillCount,
          })
        : t("propuestas.signals.unused.note")
      : group.kind === "board"
        ? tRich("propuestas.signals.board.note")
        : group.kind === "recurring"
          ? t("propuestas.signals.recurring.note")
          : null;
  return (
    <details className={`sig-group ${styles.disclosure} ${styles.signals}`}>
      <summary>
        <Icon name="activity" />
        {t(`propuestas.signals.${group.kind}.title`)}
        <CountPill count={group.items.length} />
      </summary>
      {note && <p className={styles.intro}>{note}</p>}
      {sharedCommand && <CmdRow command={sharedCommand} />}
      <p>{t("propuestas.signals.where")}</p>
      {group.items.map((item) => (
        <div
          key={`${item.kind}-${item.target ?? item.title}-${item.evidence}`}
          className={styles.signal}
        >
          <strong>{item.title}</strong>
          <p>{item.evidence}</p>
          {!sharedCommand && <CmdRow command={commandFor(item)} />}
        </div>
      ))}
    </details>
  );
}

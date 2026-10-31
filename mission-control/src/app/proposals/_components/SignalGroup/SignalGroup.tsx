import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import { t, tRich } from "@/lib/copy/copy";
import type { SignalGroupData } from "@/lib/proposals/signals";
import styles from "../ProposalsSummary/Proposals.module.css";

const GROUP_LOOK = {
  board: { tone: "blue", icon: "columns" },
  recurring: { tone: "teal", icon: "rocket" },
  unused: { tone: "slate", icon: "activity" },
  other: { tone: "slate", icon: "sparkles" },
} as const satisfies Record<SignalGroupData["kind"], { tone: Tone; icon: IconName }>;

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
    <details
      className={`sig-group ${styles.disclosure} ${styles.signals}`}
      data-tone={GROUP_LOOK[group.kind].tone}
    >
      <summary>
        <Icon name={GROUP_LOOK[group.kind].icon} size="sm" />
        <b>{t(`propuestas.signals.${group.kind}.title`)}</b>
        <Chip tone={GROUP_LOOK[group.kind].tone}>{group.items.length}</Chip>
        <span className={styles.signalChevron}>
          <Icon name="chevD" size="sm" />
        </span>
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

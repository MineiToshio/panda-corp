import { Notice } from "@/components/core/Notice/Notice";
import { Cartera } from "@/components/dashboard/Cartera/Cartera";
import { FactoryWorktrees } from "@/components/dashboard/FactoryWorktrees/FactoryWorktrees";
import { Progreso } from "@/components/dashboard/Progreso/Progreso";
import { TuTurno } from "@/components/dashboard/TuTurno/TuTurno";
import { Pulso } from "@/components/modules/Pulso/Pulso";
import type { CopyKey } from "@/lib/copy/copy";
import { t } from "@/lib/copy/copy";
import { guildAchievements, lastAchievement } from "@/lib/inicio/achievement";
import { inFlightGroups } from "@/lib/inicio/flight";
import { ideaFunnel } from "@/lib/inicio/funnel";
import { inicioGuild } from "@/lib/inicio/guild";
import { projectInboxes } from "@/lib/inicio/inbox";
import { pulseTiles } from "@/lib/inicio/pulse";
import { ownerTurnItems } from "@/lib/inicio/turn";
import { getWorktreesByRepo } from "@/lib/pendingMerge/worktreesByRepo";
import { getProjectOverview } from "@/lib/portfolio/overview";
import { EmbudoCard } from "./EmbudoCard";
import { EnMarchaCard } from "./EnMarchaCard";

function sectionError(title: CopyKey): React.JSX.Element {
  return (
    <Notice icon="alert" kind="error">
      {t(title)} · {t("inicio.worktrees.unreadable")}
    </Notice>
  );
}
function readSection(
  title: CopyKey,
  render: () => React.JSX.Element | null,
): React.JSX.Element | null {
  try {
    return render();
  } catch {
    return sectionError(title);
  }
}
/** Independent async block: inbox failures cannot blank the rest of Inicio. */
export async function TurnSection(): Promise<React.JSX.Element | null> {
  await Promise.resolve();
  return readSection("inicio.turn.title", () => <TuTurno result={ownerTurnItems()} />);
}
/** The shared portfolio card projection. */
export async function PortfolioSection(): Promise<React.JSX.Element | null> {
  await Promise.resolve();
  return readSection("inicio.portfolio.title", () => <Cartera cards={getProjectOverview()} />);
}
/** In-flight work and its named source failures. */
export async function FlightSection(): Promise<React.JSX.Element | null> {
  await Promise.resolve();
  return readSection("inicio.inFlight.title", () => (
    <EnMarchaCard
      groups={inFlightGroups()}
      errors={projectInboxes().flatMap((project) =>
        project.errors.filter(
          (error) => error.source === "changes" || error.source === "work-orders",
        ),
      )}
    />
  ));
}
/** Factory pulse, from the card projection already used by Cartera. */
export async function PulseSection(): Promise<React.JSX.Element | null> {
  await Promise.resolve();
  return readSection("inicio.pulse.title", () => (
    <Pulso tiles={pulseTiles(getProjectOverview())} />
  ));
}
/** Guild read failures degrade only the guild card. */
export async function GuildSection(): Promise<React.JSX.Element | null> {
  await Promise.resolve();
  return readSection("inicio.guild.title", () => {
    const guild = inicioGuild();
    return (
      <Progreso
        level={guild.level}
        achievement={lastAchievement()}
        trophies={guildAchievements().filter((item) => item.unlocked).length}
      />
    );
  });
}
/** Board funnel, independently guarded from the other sections. */
export async function FunnelSection(): Promise<React.JSX.Element | null> {
  await Promise.resolve();
  return readSection("inicio.funnel.title", () => <EmbudoCard funnel={ideaFunnel()} />);
}
/** Slow git traversal is behind its own Suspense boundary. */
export async function WorktreesSection(): Promise<React.JSX.Element | null> {
  try {
    const rows = await getWorktreesByRepo();
    return <FactoryWorktrees rows={rows} />;
  } catch {
    return sectionError("inicio.worktrees.title");
  }
}

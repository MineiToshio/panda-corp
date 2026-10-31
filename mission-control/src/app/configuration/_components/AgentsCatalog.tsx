import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar, SPRITE_MAP } from "@/components/core/Avatar/Avatar";
import { Chip } from "@/components/core/Chip/Chip";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { t } from "@/lib/copy/copy";
import { modelTier } from "@/lib/reference/modelTier";
import type { AgentRef } from "@/lib/reference/reference";
import styles from "../configuration.module.css";
import { matches } from "./catalogViews";

/** Explicit effort only; missing effort is never inferred from the model. */
export function EffortChip({ agent }: { agent: AgentRef }): React.JSX.Element {
  return (
    <Chip tone="blue" variant="plain">
      {agent.effort
        ? t("configuracion.agents.effort", {
            level: t(`configuracion.agents.effortLevels.${agent.effort}`),
          })
        : t("configuracion.agents.defaultEffort")}
    </Chip>
  );
}
function spriteRole(id: string): AgentRole | undefined {
  return Object.hasOwn(SPRITE_MAP, id) ? (id as AgentRole) : undefined;
}
/** Tier groups with shared explanations and accessible sprite/initial avatars. */
export function AgentsCatalog({
  agents,
  query,
  onOpen,
}: {
  agents: AgentRef[];
  query: string;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const filtered = agents.filter((agent) =>
    matches(query, agent.name, agent.id, agent.description, agent.body),
  );
  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{t("configuracion.counts.agent", { count: filtered.length })}</p>
      {(["opus", "sonnet", "haiku", "unknown"] as const).map((tier) => {
        const group = filtered.filter((agent) => modelTier(agent.model) === tier);
        return group.length ? (
          <section key={tier}>
            <SectionHead
              label={t(`configuracion.agents.models.${tier}.label`)}
              note={t(`configuracion.agents.models.${tier}.hint`)}
              count={group.length}
              tone="blue"
            />
            <div className={`agent-grid ${styles.agents}`}>
              {group.map((agent) => (
                <button
                  type="button"
                  className={styles.agent}
                  key={agent.id}
                  onClick={() => onOpen(agent.id)}
                >
                  <Avatar
                    agentId={spriteRole(agent.id)}
                    name={agent.name ?? agent.id}
                    label={agent.name ?? agent.id}
                    tone="blue"
                  />
                  <span>
                    <strong>{agent.name ?? agent.id}</strong>
                    <Chip tone="blue">
                      {t(`configuracion.agents.models.${modelTier(agent.model)}.label`)}
                    </Chip>
                    <EffortChip agent={agent} />
                    <small>{agent.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null;
      })}
      {!filtered.length ? <p>{t("configuracion.agents.empty")}</p> : null}
    </div>
  );
}

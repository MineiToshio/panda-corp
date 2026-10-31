import { Chip } from "@/components/core/Chip/Chip";
import { CopyText } from "@/components/core/CopyText/CopyText";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { Modal } from "@/components/core/Modal/Modal";
import { t } from "@/lib/copy/copy";
import type { ConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import { modelTier } from "@/lib/reference/modelTier";
import styles from "../configuration.module.css";
import { EffortChip } from "./AgentsCatalog";
import { type CatalogSection, domainLabel, severityLabel } from "./catalogViews";

interface DialogProps {
  catalogs: ConfigurationCatalogs;
  section: string;
  item: string;
  onOpen: (section: CatalogSection, item?: string) => void;
  onClose: () => void;
}
/** Read-only definitions and bidirectional skill/agent links in the shared native dialog. */
export function CatalogDialog(props: DialogProps): React.JSX.Element | null {
  if (!props.item) return null;
  switch (props.section) {
    case "skills":
      return <SkillDialog {...props} />;
    case "agents":
      return <AgentDialog {...props} />;
    case "standards":
      return <StandardDialog {...props} />;
    default:
      return null;
  }
}
function SkillDialog({ catalogs, item, onOpen, onClose }: DialogProps): React.JSX.Element | null {
  if (!catalogs.skills.ok) return null;
  const skill = catalogs.skills.data.find((entry) => entry.slug === item);
  if (!skill) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`/pandacorp:${skill.slug}`}
      kicker={t("dialogs.skill.kicker")}
      tone="violet"
      testIdBase="skill-dialog"
    >
      <div className={styles.stack}>
        <div className={styles.filters}>
          <Chip tone="violet">
            {t(skill.internal ? "dialogs.skill.internalEngine" : "dialogs.skill.ownerCommand")}
          </Chip>
          <Chip tone="slate" variant="plain">
            {t(`configuracion.skills.scopes.${skill.runsIn}.label`)}
          </Chip>
        </div>
        <p>{skill.description}</p>
        <div className={styles.filters}>
          {t("dialogs.skill.agents")}
          {(skill.agents ?? [])
            .filter(
              (id) => catalogs.agents.ok && catalogs.agents.data.some((agent) => agent.id === id),
            )
            .map((id) => (
              <button
                type="button"
                className={styles.link}
                key={id}
                onClick={() => onOpen("agents", id)}
              >
                {id}
              </button>
            ))}
        </div>
        <CopyText text={`/pandacorp:${skill.slug}`} />
        <details>
          <summary>{t("dialogs.skill.fullDefinition")}</summary>
          <Markdown>{skill.body}</Markdown>
        </details>
      </div>
    </Modal>
  );
}
function AgentDialog({ catalogs, item, onOpen, onClose }: DialogProps): React.JSX.Element | null {
  if (!catalogs.agents.ok) return null;
  const agent = catalogs.agents.data.find((entry) => entry.id === item);
  if (!agent) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={agent.name ?? agent.id}
      kicker={t("dialogs.agent.kicker")}
      tone="blue"
      testIdBase="agent-dialog"
    >
      <div className={styles.stack}>
        <div className={styles.filters}>
          <Chip tone="blue">
            {t(`configuracion.agents.models.${modelTier(agent.model)}.label`)}
          </Chip>
          <EffortChip agent={agent} />
        </div>
        <p>{agent.description}</p>
        <div className={styles.filters}>
          {t("dialogs.agent.tools")}
          {agent.tools?.map((tool) => (
            <Chip tone="slate" variant="plain" key={tool}>
              {tool}
            </Chip>
          ))}
        </div>
        <div className={styles.filters}>
          {t("dialogs.agent.usedBy")}
          {catalogs.skillsByAgent[agent.id]?.map((slug) => (
            <button
              type="button"
              className={styles.link}
              key={slug}
              onClick={() => onOpen("skills", slug)}
            >
              /pandacorp:{slug}
            </button>
          ))}
        </div>
        <details>
          <summary>{t("dialogs.agent.fullDefinition")}</summary>
          <Markdown>{agent.body}</Markdown>
        </details>
      </div>
    </Modal>
  );
}
function StandardDialog({ catalogs, item, onClose }: DialogProps): React.JSX.Element | null {
  if (!catalogs.standards.ok) return null;
  const standard = catalogs.standards.data.find((entry) => entry.id === item);
  if (!standard) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={standard.title}
      kicker={t("dialogs.standard.kicker", { domain: domainLabel(standard.domain) })}
      tone="teal"
      testIdBase="standard-dialog"
    >
      <div className={styles.filters}>
        <Chip tone="teal">{severityLabel(standard.severity)}</Chip>
        <Chip tone="slate" variant="plain">
          {domainLabel(standard.domain)}
        </Chip>
        <Chip tone="slate" variant="plain">
          {standard.enforcement}
        </Chip>
      </div>
      <div data-testid="standard-markdown-body">
        <Markdown>{standard.body}</Markdown>
      </div>
    </Modal>
  );
}

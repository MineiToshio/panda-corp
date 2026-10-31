import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { DialogSheet } from "@/components/core/Modal/DialogSheet";
import { Modal } from "@/components/core/Modal/Modal";
import { PlanMosaic } from "@/components/modules/ReportBand/PlanMosaic";
import styles from "@/components/modules/ReportBand/reportBand.module.css";
import { t } from "@/lib/copy/copy";
import type { DigestFrd } from "@/lib/spec/read-frds";
import type { SpecFrd } from "@/lib/spec/spec";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

/** Modal body shared by the Spec contract and architecture plan; no dependency DAG. */
export function FrdDetail({
  frd,
  live,
  workOrders,
  blueprint,
  architecture = false,
  started = false,
  onClose,
  resolveLink,
  navigationBaseHref,
}: {
  readonly frd: Pick<SpecFrd, "id" | "title"> & Partial<SpecFrd>;
  readonly live?: DigestFrd;
  readonly workOrders: readonly WorkOrder[];
  readonly blueprint?: string;
  readonly architecture?: boolean;
  readonly started?: boolean;
  readonly onClose: () => void;
  readonly resolveLink?: LinkResolver;
  readonly navigationBaseHref?: string;
}): React.JSX.Element {
  const detail = live?.detail ?? frd;
  const sections = [
    {
      id: "vision",
      label: t("workspace.spec.frdDetail.vision"),
      content: detail.overview || detail.summary,
    },
    {
      id: "implementation",
      label: t("workspace.spec.frdDetail.implementation"),
      content: blueprint,
    },
    {
      id: "userStories",
      label: t("workspace.spec.frdDetail.userStories"),
      content: detail.userStories,
    },
    {
      id: "businessRules",
      label: t("workspace.spec.frdDetail.businessRules"),
      content: detail.businessRules,
    },
    {
      id: "outOfScope",
      label: t("workspace.spec.frdDetail.outOfScope"),
      content: detail.outOfScope,
    },
    {
      id: "openQuestions",
      label: t("workspace.spec.frdDetail.openQuestions"),
      content: detail.openQuestions,
    },
  ];
  const rows = sections
    .filter((section) => section.content && section.content.length > 0)
    .map((section) => ({
      id: section.id,
      label: section.label,
      content: Array.isArray(section.content) ? (
        <ul>
          {section.content.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <Markdown resolveLink={resolveLink}>{section.content ?? ""}</Markdown>
      ),
    }));
  const slug = live?.slug;
  const contract = slug ? `docs/frds/${slug}/frd.md` : undefined;
  const plan = slug ? `docs/frds/${slug}/blueprint.md` : undefined;
  return (
    <Modal
      open
      title={`${frd.id} · ${frd.title}`}
      kicker={t(
        architecture
          ? "workspace.spec.frdCard.kickerBlueprint"
          : "workspace.spec.frdCard.kickerSpec",
        { code: frd.id },
      )}
      onClose={onClose}
      testIdBase={architecture ? "arch-frd" : "spec-frd"}
      tone="violet"
      footer={
        <div className={styles.links}>
          {contract && (
            <DocumentAction
              file={contract}
              label={t("workspace.spec.frdDetail.contract")}
              resolveLink={resolveLink}
              base={navigationBaseHref}
            />
          )}
          {plan && (
            <DocumentAction
              file={plan}
              label={t("workspace.spec.frdDetail.blueprint")}
              resolveLink={resolveLink}
              base={navigationBaseHref}
            />
          )}
          {navigationBaseHref && (
            <a href={`${navigationBaseHref}/observability?frd=${encodeURIComponent(frd.id)}`}>
              {t("workspace.spec.frdDetail.seeWorkOrders")}
            </a>
          )}
        </div>
      }
    >
      <DialogSheet rows={rows} />
      <h3>{t("workspace.spec.frdDetail.workOrders")}</h3>
      <PlanMosaic workOrders={workOrders} started={started} />
      {workOrders.map((order) => (
        <p key={order.id} data-testid="arch-frd-wo">
          <code>{order.id}</code> {order.title}
        </p>
      ))}
    </Modal>
  );
}

function DocumentAction({
  file,
  label,
  resolveLink,
  base,
}: {
  file: string;
  label: string;
  resolveLink?: LinkResolver;
  base?: string;
}): React.JSX.Element | null {
  const link = resolveLink?.(file);
  if (link && "onSelect" in link)
    return (
      <button type="button" onClick={link.onSelect}>
        {label}
      </button>
    );
  if (link && "href" in link) return <a href={link.href}>{label}</a>;
  if (base)
    return (
      <a href={`${base}/documents/${encodeURIComponent(file.replace(/\.md$/, ""))}`}>{label}</a>
    );
  return null;
}

"use client";

import { Chip } from "@/components/core/Chip/Chip";
import type { LinkResolver } from "@/components/core/Markdown/Markdown";
import { Notice } from "@/components/core/Notice/Notice";
import { projectMetaChips } from "@/components/modules/IdeaCard/IdeaCard";
import { DigestHero } from "@/components/modules/ReportBand/DigestHero";
import { ReportBand } from "@/components/modules/ReportBand/ReportBand";
import styles from "@/components/modules/ReportBand/reportBand.module.css";
import {
  digestNavigationBase,
  hasConstructionStarted,
} from "@/components/modules/Spec/digestState";
import { FrdCard } from "@/components/modules/Spec/FrdCard";
import { FrdDetail } from "@/components/modules/Spec/FrdDetail";
import { t } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import type { DigestSourceErrors } from "@/lib/spec/read-artifacts";
import type { DigestFrd } from "@/lib/spec/read-frds";
import { parseSpec } from "@/lib/spec/spec";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { BlockContent } from "./BlockContent";

export interface SpecDigestProps {
  readonly body: string;
  readonly title: string;
  readonly projectType?: string;
  readonly targetPlatforms?: string;
  readonly frdCount?: number;
  readonly resolveLink?: LinkResolver;
  readonly frds?: readonly DigestFrd[];
  readonly workOrders?: readonly WorkOrder[];
  readonly constructionStarted?: boolean;
  readonly navigationBaseHref?: string;
  readonly project?: string;
  readonly sourceErrors?: DigestSourceErrors;
}

/** Shared native Spec report; authored narrative and live artifact state have separate inputs. */
export function SpecDigest({
  body,
  title,
  projectType,
  targetPlatforms,
  frdCount,
  resolveLink,
  frds,
  workOrders = [],
  constructionStarted,
  navigationBaseHref,
  project,
  sourceErrors,
}: SpecDigestProps): React.JSX.Element {
  const spec = parseSpec(body);
  const [selected, setSelected] = useUrlState("specFrd", "");
  const cards = specCards(spec, frds);
  const open = cards.find((frd) => frd.id === selected);
  const started = hasConstructionStarted(spec.fase, workOrders, constructionStarted);
  const base = digestNavigationBase(navigationBaseHref, project);
  return (
    <article data-testid="card-detail-spec" aria-label={t("workspace.spec.eyebrow")}>
      <SpecHero
        spec={spec}
        title={title}
        projectType={projectType}
        targetPlatforms={targetPlatforms}
      />
      {!spec.hasContent && !frds?.length && (
        <Notice icon="book">{t("workspace.spec.notPublished.title")}</Notice>
      )}
      {spec.prd && spec.prd.blocks.length > 0 && (
        <ReportBand
          title={t("workspace.spec.bands.prd")}
          tone="teal"
          rows={spec.prd.blocks.map((block) => ({
            id: block.label,
            label: block.label,
            content: <BlockContent block={block} resolveLink={resolveLink} />,
          }))}
        />
      )}
      {spec.research && spec.research.blocks.length > 0 && (
        <ReportBand
          title={t("workspace.spec.bands.research")}
          tone="blue"
          rows={spec.research.blocks.map((block) => ({
            id: block.label,
            label: block.label,
            content: <BlockContent block={block} resolveLink={resolveLink} />,
          }))}
        />
      )}
      {sourceErrors?.frds && (
        <Notice icon="alert" kind="error">
          {sourceErrors.frds}
        </Notice>
      )}
      {cards.length > 0 && (
        <ReportBand
          title={
            frdCount === undefined && !frds
              ? t("workspace.spec.bands.frds", { count: cards.length }).replace(/ \(\d+\)$/u, "")
              : t("workspace.spec.bands.frds", { count: frds?.length ?? frdCount ?? 0 })
          }
          tone="violet"
        >
          <div className={styles.grid}>
            {cards.map((frd) => (
              <FrdCard
                key={frd.id}
                frd={frd}
                workOrders={
                  frd.live?.workOrders ??
                  workOrders.filter((order) => order.id.startsWith(frd.id.replace("FRD-", "WO-")))
                }
                started={started}
                onOpen={() => setSelected(frd.id)}
                testId="spec-frd"
              />
            ))}
          </div>
        </ReportBand>
      )}
      {sourceErrors?.workOrders && (
        <Notice icon="alert" kind="error">
          {sourceErrors.workOrders}
        </Notice>
      )}
      {selected && !open && <p role="status">El FRD seleccionado no está disponible.</p>}
      {open && (
        <FrdDetail
          frd={open}
          live={open.live}
          workOrders={
            open.live?.workOrders ??
            workOrders.filter((order) => order.id.startsWith(open.id.replace("FRD-", "WO-")))
          }
          started={started}
          onClose={() => setSelected("")}
          resolveLink={resolveLink}
          navigationBaseHref={base}
        />
      )}
    </article>
  );
}

function SpecHero({
  spec,
  title,
  projectType,
  targetPlatforms,
}: {
  spec: ReturnType<typeof parseSpec>;
  title: string;
  projectType?: string;
  targetPlatforms?: string;
}): React.JSX.Element {
  return (
    <DigestHero
      eyebrow={t("workspace.spec.eyebrow")}
      title={spec.proyecto ?? title}
      lead={spec.intro}
      chips={
        <>
          {spec.fase && (
            <Chip tone="violet">{t("workspace.spec.phaseChip", { phase: spec.fase })}</Chip>
          )}
          {projectMetaChips(projectType, targetPlatforms).map((chip) => (
            <span key={chip.label} data-testid="spec-meta-chip">
              <Chip tone="slate">{chip.label}</Chip>
            </span>
          ))}
        </>
      }
    />
  );
}

function specCards(spec: ReturnType<typeof parseSpec>, frds?: readonly DigestFrd[]) {
  return frds
    ? frds.map((live) => ({
        ...spec.frds.find((frd) => frd.id === live.id),
        id: live.id,
        title: live.title,
        ui: live.ui,
        live,
      }))
    : spec.frds.map((frd) => ({ ...frd, live: undefined, ui: undefined }));
}

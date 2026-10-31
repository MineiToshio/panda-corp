"use client";

import { Button } from "@/components/core/Button/Button";
import { ButtonLink } from "@/components/core/Button/ButtonLink";
import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import type { LinkResolver } from "@/components/core/Markdown/Markdown";
import { Notice } from "@/components/core/Notice/Notice";
import { FileReadErrors } from "@/components/modules/FileReadErrors/FileReadErrors";
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
  /** Hide the default notice when the workspace provides its linked notice. */
  readonly showUnpublishedNotice?: boolean;
  readonly showEyebrow?: boolean;
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
  showUnpublishedNotice = true,
  showEyebrow = true,
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
      {(spec.hasContent || showUnpublishedNotice) && (
        <SpecHero
          showEyebrow={showEyebrow}
          spec={spec}
          title={title}
          projectType={projectType}
          targetPlatforms={targetPlatforms}
        />
      )}
      {showUnpublishedNotice && !spec.hasContent && !frds?.length && (
        <Notice icon="book">{t("workspace.spec.notPublished.title")}</Notice>
      )}
      {spec.prd && spec.prd.blocks.length > 0 && (
        <ReportBand
          title={t("workspace.spec.bands.prd")}
          tone="blue"
          icon="flag"
          action={documentAction(
            resolveLink,
            "docs/product/prd.md",
            t("workspace.spec.buttons.prdFull"),
            { icon: "flag", tone: "blue" },
          )}
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
          tone="teal"
          icon="search"
          action={documentAction(
            resolveLink,
            "docs/product/research.md",
            t("workspace.spec.buttons.researchFull"),
            { icon: "search", tone: "teal" },
          )}
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
          icon="book"
        >
          <div className={styles.frdGrid}>
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
      <SpecWorkOrderErrors sourceErrors={sourceErrors} />
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
  showEyebrow,
  spec,
  title,
  projectType,
  targetPlatforms,
}: {
  showEyebrow: boolean;
  spec: ReturnType<typeof parseSpec>;
  title: string;
  projectType?: string;
  targetPlatforms?: string;
}): React.JSX.Element {
  return (
    <DigestHero
      eyebrow={showEyebrow ? t("workspace.spec.eyebrow") : undefined}
      title={spec.proyecto ?? title}
      lead={spec.intro}
      chips={
        <>
          {spec.fase && (
            <Chip tone="blue">{t("workspace.spec.phaseChip", { phase: spec.fase })}</Chip>
          )}
          {projectMetaChips(projectType, targetPlatforms).map((chip, index) => (
            <span key={chip.label} data-testid="spec-meta-chip">
              <Chip
                tone="slate"
                variant="plain"
                icon={projectType && index === 0 ? "cube" : undefined}
              >
                {chip.label}
              </Chip>
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

function documentAction(
  resolveLink: LinkResolver | undefined,
  path: string,
  label: string,
  look: { readonly icon: IconName; readonly tone: Tone },
): React.ReactNode {
  const target = resolveLink?.(path);
  if (!target) return null;
  const content = (
    <>
      <Icon name={look.icon} size="sm" />
      {label}
    </>
  );
  return "onSelect" in target ? (
    <Button size="sm" variant="toned" tone={look.tone} onClick={target.onSelect}>
      {content}
    </Button>
  ) : (
    <ButtonLink look="button" size="sm" tone={look.tone} href={target.href}>
      {content}
    </ButtonLink>
  );
}

function SpecWorkOrderErrors({
  sourceErrors,
}: {
  readonly sourceErrors?: DigestSourceErrors;
}): React.JSX.Element | null {
  if (sourceErrors?.workOrderFiles?.length)
    return <FileReadErrors errors={sourceErrors.workOrderFiles} />;
  if (sourceErrors?.workOrders)
    return (
      <Notice icon="alert" kind="error">
        {sourceErrors.workOrders}
      </Notice>
    );
  return null;
}

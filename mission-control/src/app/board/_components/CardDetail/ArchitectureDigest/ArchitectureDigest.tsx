"use client";

import { Chip } from "@/components/core/Chip/Chip";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { Modal } from "@/components/core/Modal/Modal";
import { Notice } from "@/components/core/Notice/Notice";
import { DataModelViewer } from "@/components/modules/DataModelViewer/DataModelViewer";
import { projectMetaChips } from "@/components/modules/IdeaCard/IdeaCard";
import { AdrRow } from "@/components/modules/ReportBand/AdrRow";
import { DigestHero } from "@/components/modules/ReportBand/DigestHero";
import { EnvFold } from "@/components/modules/ReportBand/EnvRow";
import { PlanMosaic } from "@/components/modules/ReportBand/PlanMosaic";
import { ReportBand } from "@/components/modules/ReportBand/ReportBand";
import styles from "@/components/modules/ReportBand/reportBand.module.css";
import {
  digestNavigationBase,
  hasConstructionStarted,
} from "@/components/modules/Spec/digestState";
import { FrdCard } from "@/components/modules/Spec/FrdCard";
import { FrdDetail } from "@/components/modules/Spec/FrdDetail";
import type { Adr } from "@/lib/architecture/adr";
import { parseArchitecture } from "@/lib/architecture/architecture";
import type { DataModelResult } from "@/lib/architecture/data-model/types";
import type { EnvVar } from "@/lib/architecture/env";
import { t } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import type { DigestSourceErrors } from "@/lib/spec/read-artifacts";
import type { DigestFrd } from "@/lib/spec/read-frds";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

export interface ArchitectureDigestProps {
  readonly body: string;
  readonly title: string;
  readonly dataModel?: DataModelResult;
  readonly projectType?: string;
  readonly targetPlatforms?: string;
  readonly workOrders?: WorkOrder[];
  readonly envVars?: EnvVar[];
  readonly adrs?: Adr[];
  readonly project?: string;
  readonly resolveLink?: LinkResolver;
  readonly frds?: readonly DigestFrd[];
  readonly constructionStarted?: boolean;
  readonly navigationBaseHref?: string;
  readonly sourceErrors?: DigestSourceErrors;
}

/** Shared architecture report: authored narrative plus independently read live artifact bands. */
export function ArchitectureDigest({
  body,
  title,
  dataModel,
  projectType,
  targetPlatforms,
  workOrders = [],
  envVars = [],
  adrs = [],
  project,
  resolveLink,
  frds,
  constructionStarted,
  navigationBaseHref,
  sourceErrors,
}: ArchitectureDigestProps): React.JSX.Element {
  const arch = parseArchitecture(body);
  const [adrId, setAdrId] = useUrlState("adr", "");
  const [frdId, setFrdId] = useUrlState("architectureFrd", "");
  const adr = adrs.find((item) => item.id === adrId);
  const cards = frds
    ? frds.map((live) => ({
        id: live.id,
        title: live.title,
        blueprint: arch.frds.find((frd) => frd.id === live.id)?.blueprint || live.blueprint,
        ui: live.ui,
        live,
      }))
    : arch.frds.map((frd) => ({ ...frd, live: undefined, ui: undefined }));
  const open = cards.find((frd) => frd.id === frdId);
  const started = hasConstructionStarted(arch.fase, workOrders, constructionStarted);
  const base = digestNavigationBase(navigationBaseHref, project);
  const notPublished = isNotPublished(arch.hasContent, dataModel);
  return (
    <article
      data-testid="card-detail-architecture"
      data-scroll-x="intentional"
      aria-label="Resumen de la arquitectura"
    >
      <ArchitectureHero
        arch={arch}
        title={title}
        projectType={projectType}
        targetPlatforms={targetPlatforms}
      />
      {notPublished && <Notice icon="book">{t("workspace.arquitectura.notPublished")}</Notice>}
      {arch.stackRows.length > 0 && (
        <ReportBand
          title={t("workspace.arquitectura.stack.title")}
          tone="blue"
          testId="arch-stack"
          rows={arch.stackRows.map((row, index) => ({
            id: `${row.capa}-${index}`,
            label: row.capa,
            content: (
              <>
                <b>{row.eleccion}</b>
                <p>{row.porque}</p>
              </>
            ),
          }))}
        />
      )}
      {arch.services.length > 0 && (
        <ReportBand
          title={t("workspace.arquitectura.services.title")}
          tone="teal"
          testId="arch-services"
          rows={arch.services.map((service, index) => ({
            id: `${index}`,
            label: service.desc ? service.title : "",
            content: (
              <div data-testid="arch-service">
                <Markdown resolveLink={resolveLink}>{service.desc || service.title}</Markdown>
              </div>
            ),
          }))}
        />
      )}
      <ModelBand arch={arch} dataModel={dataModel} notPublished={notPublished} />
      {!notPublished && (
        <>
          {hasBandContent(envVars.length, sourceErrors?.env) && (
            <EnvironmentBand entries={envVars} error={sourceErrors?.env} />
          )}
          {hasBandContent(adrs.length, sourceErrors?.adrs) && (
            <ReportBand
              title={t("workspace.arquitectura.adrs.title", { count: adrs.length })}
              testId="arch-adrs"
              tone="violet"
            >
              {sourceErrors?.adrs ? (
                <Notice icon="alert" kind="error">
                  {sourceErrors.adrs}
                </Notice>
              ) : (
                adrs.map((item) => (
                  <AdrRow key={item.id} adr={item} onOpen={() => setAdrId(item.id)} />
                ))
              )}
            </ReportBand>
          )}
          <ReportBand
            title={t("workspace.arquitectura.plan.title")}
            testId="arch-plan"
            tone="violet"
          >
            {sourceErrors?.workOrders ? (
              <Notice icon="alert" kind="error">
                {sourceErrors.workOrders}
              </Notice>
            ) : (
              <PlanMosaic workOrders={workOrders} started={started} />
            )}
            {sourceErrors?.frds && (
              <Notice icon="alert" kind="error">
                {sourceErrors.frds}
              </Notice>
            )}
            <div className={styles.grid}>
              {cards.map((frd) => (
                <FrdCard
                  key={frd.id}
                  frd={{ ...frd, summary: frd.blueprint }}
                  workOrders={frd.live?.workOrders ?? ordersForFrd(frd.id, workOrders)}
                  started={started}
                  onOpen={() => setFrdId(frd.id)}
                  testId="arch-frd"
                />
              ))}
            </div>
          </ReportBand>
        </>
      )}
      {adrId && !adr && <p role="status">El ADR seleccionado no está disponible.</p>}
      {frdId && !open && <p role="status">El FRD seleccionado no está disponible.</p>}
      {adr && (
        <Modal
          open
          title={`${adr.id} · ${adr.title}`}
          kicker={adr.id}
          testIdBase="arch-adr"
          tone="violet"
          onClose={() => setAdrId("")}
        >
          <AdrDocument adr={adr} resolveLink={resolveLink} />
        </Modal>
      )}
      {open && (
        <FrdDetail
          architecture
          frd={open}
          live={open.live}
          blueprint={open.blueprint}
          workOrders={open.live?.workOrders ?? ordersForFrd(open.id, workOrders)}
          started={started}
          onClose={() => setFrdId("")}
          resolveLink={resolveLink}
          navigationBaseHref={base}
        />
      )}
    </article>
  );
}

function isNotPublished(hasContent: boolean, model?: DataModelResult): boolean {
  return !hasContent && (!model || model.kind === "missing");
}

function hasBandContent(count: number, error?: string): boolean {
  return count > 0 || Boolean(error);
}

function ordersForFrd(id: string, orders: readonly WorkOrder[]): WorkOrder[] {
  return orders.filter((order) => order.id.startsWith(`${id.replace("FRD-", "WO-")}-`));
}

function EnvironmentBand({
  entries,
  error,
}: {
  entries: readonly EnvVar[];
  error?: string;
}): React.JSX.Element {
  const groups = new Map<string, EnvVar[]>();
  for (const entry of entries) {
    const key = entry.section || t("workspace.arquitectura.env.generalGroup");
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const missing = entries.filter((entry) => entry.described === false || !entry.comment).length;
  return (
    <ReportBand
      title={t("workspace.arquitectura.env.title", { count: entries.length })}
      testId="arch-env-block"
      tone="gold"
    >
      {error ? (
        <Notice icon="alert" kind="error">
          {error}
        </Notice>
      ) : (
        <>
          {entries.length > 0 && (
            <Chip tone={missing ? "amber" : "teal"}>
              {missing
                ? t("workspace.arquitectura.env.missingChip", { missing, total: entries.length })
                : t("workspace.arquitectura.env.allDescribed")}
            </Chip>
          )}
          {[...groups].map(([group, items]) => (
            <EnvFold key={group} group={group} entries={items} />
          ))}
        </>
      )}
    </ReportBand>
  );
}

function AdrDocument({
  adr,
  resolveLink,
}: {
  adr: Adr;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  const metadata = adr.body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return (
    <>
      {metadata && (
        <details>
          <summary>Metadatos del documento</summary>
          <pre>{metadata[1]}</pre>
        </details>
      )}
      <Markdown resolveLink={resolveLink}>
        {metadata ? adr.body.slice(metadata[0].length) : adr.body}
      </Markdown>
    </>
  );
}

function ArchitectureHero({
  arch,
  title,
  projectType,
  targetPlatforms,
}: {
  arch: ReturnType<typeof parseArchitecture>;
  title: string;
  projectType?: string;
  targetPlatforms?: string;
}): React.JSX.Element {
  return (
    <DigestHero
      eyebrow={t("workspace.arquitectura.eyebrow")}
      title={arch.proyecto ?? title}
      lead={
        <>
          {arch.stack && <p>{arch.stack}</p>}
          {arch.intro && arch.intro !== arch.stack && <p>{arch.intro}</p>}
        </>
      }
      chips={
        <>
          {arch.host && (
            <span data-testid="arch-chip-host">
              <Chip tone="slate">{arch.host}</Chip>
            </span>
          )}
          {arch.coste && (
            <span data-testid="arch-chip-coste">
              <Chip tone="slate">{arch.coste}</Chip>
            </span>
          )}
          {arch.fase && (
            <Chip tone="violet">{t("workspace.spec.phaseChip", { phase: arch.fase })}</Chip>
          )}
          {projectMetaChips(projectType, targetPlatforms).map((chip) => (
            <span key={chip.label} data-testid="arch-meta-chip">
              <Chip tone="slate">{chip.label}</Chip>
            </span>
          ))}
        </>
      }
    />
  );
}

function ModelBand({
  arch,
  dataModel,
  notPublished,
}: {
  arch: ReturnType<typeof parseArchitecture>;
  dataModel?: DataModelResult;
  notPublished: boolean;
}): React.JSX.Element {
  return (
    <ReportBand
      title={t("workspace.arquitectura.dataModel.title")}
      tone="teal"
      testId="arch-data-model"
    >
      {arch.dataModel?.note && <p>{arch.dataModel.note}</p>}
      {arch.dataModel?.entities.map((entity) => (
        <p key={entity.title}>
          <b>{entity.title}</b>
          {entity.desc && `: ${entity.desc}`}
        </p>
      ))}
      {!notPublished && (
        <DataModelViewer
          result={dataModel ?? (arch.dataModel?.isNone ? { kind: "none" } : { kind: "missing" })}
        />
      )}
    </ReportBand>
  );
}

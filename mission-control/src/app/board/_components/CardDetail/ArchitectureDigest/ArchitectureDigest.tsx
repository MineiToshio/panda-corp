"use client";

import { Chip } from "@/components/core/Chip/Chip";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { Modal } from "@/components/core/Modal/Modal";
import { Notice } from "@/components/core/Notice/Notice";
import { DataModelViewer } from "@/components/modules/DataModelViewer/DataModelViewer";
import { FileReadErrors } from "@/components/modules/FileReadErrors/FileReadErrors";
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
import { t, tRich } from "@/lib/copy/copy";
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
  const planFrds = cards.map((card) => ({
    id: card.id,
    title: arch.frds.find((item) => item.id === card.id)?.title ?? card.title,
  }));
  const open = cards.find((frd) => frd.id === frdId);
  const started = hasConstructionStarted(arch.fase, workOrders, constructionStarted);
  const base = digestNavigationBase(navigationBaseHref, project);
  const notPublished = isNotPublished(arch.hasContent, dataModel);
  return (
    <article
      className={styles.architecture}
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
          icon="layers"
        >
          <p>{t("workspace.arquitectura.stack.note")}</p>
          <table className={styles.stackTable}>
            <thead>
              <tr>
                <th scope="col">{t("workspace.arquitectura.stack.layer")}</th>
                <th scope="col">{t("workspace.arquitectura.stack.choice")}</th>
                <th scope="col">{t("workspace.arquitectura.stack.why")}</th>
              </tr>
            </thead>
            <tbody>
              {arch.stackRows.map((row) => (
                <tr key={row.capa}>
                  <td>{row.capa}</td>
                  <td>
                    <b>{row.eleccion}</b>
                  </td>
                  <td>{row.porque}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportBand>
      )}
      {arch.services.length > 0 && (
        <ReportBand
          title={t("workspace.arquitectura.services.title")}
          icon="activity"
          tone="teal"
          testId="arch-services"
        >
          <p>{t("workspace.arquitectura.services.note")}</p>
          <ul className={styles.services}>
            {arch.services.map((service) => (
              <li key={service.title} data-testid="arch-service">
                <Markdown resolveLink={resolveLink}>
                  {service.desc ? `**${service.title}**: ${service.desc}` : service.title}
                </Markdown>
              </li>
            ))}
          </ul>
        </ReportBand>
      )}
      <ModelBand arch={arch} dataModel={dataModel} notPublished={notPublished} />
      {!notPublished && (
        <>
          {hasBandContent(envVars.length, sourceErrors?.env) && (
            <EnvironmentBand entries={envVars} error={sourceErrors?.env} />
          )}
          {hasBandContent(adrs.length, sourceErrors?.adrs) && (
            <ReportBand
              title={t("workspace.arquitectura.adrs.heading")}
              count={adrs.length}
              icon="branch"
              testId="arch-adrs"
              tone="gold"
            >
              {sourceErrors?.adrs ? (
                <Notice icon="alert" kind="error">
                  {sourceErrors.adrs}
                </Notice>
              ) : (
                adrs.map((item) => (
                  <AdrRow
                    key={`${item.id}:${item.title}`}
                    adr={item}
                    onOpen={() => setAdrId(item.id)}
                  />
                ))
              )}
            </ReportBand>
          )}
          <ReportBand
            title={t("workspace.arquitectura.plan.title")}
            icon="layers"
            testId="arch-plan"
            tone="violet"
          >
            <p className={styles.bandNote}>{t("workspace.arquitectura.plan.note")}</p>
            <ArchitecturePlan
              sourceErrors={sourceErrors}
              workOrders={workOrders}
              started={started}
              frds={planFrds}
            />
            {sourceErrors?.frds && (
              <Notice icon="alert" kind="error">
                {sourceErrors.frds}
              </Notice>
            )}
            <h4 className={styles.planSubtitle}>{t("workspace.arquitectura.plan.byFrd")}</h4>
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
      title={t("workspace.arquitectura.env.heading")}
      count={entries.length}
      icon="terminal"
      testId="arch-env-block"
      tone="pink"
    >
      {error ? (
        <Notice icon="alert" kind="error">
          {error}
        </Notice>
      ) : (
        <>
          {entries.length > 0 && (
            <Chip tone={missing ? "amber" : "teal"} variant="outline">
              {missing
                ? t("workspace.arquitectura.env.missingChip", { missing, total: entries.length })
                : t("workspace.arquitectura.env.allDescribed")}
            </Chip>
          )}
          <p>{tRich("workspace.arquitectura.env.note")}</p>
          {[...groups].map(([group, items], index) => (
            <EnvFold key={group} group={group} entries={items} defaultOpen={index === 0} />
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
              <Chip tone="slate" variant="plain" icon="cube">
                {arch.host}
              </Chip>
            </span>
          )}
          {arch.coste && (
            <span data-testid="arch-chip-coste">
              <Chip tone="green">{arch.coste}</Chip>
            </span>
          )}
          {arch.fase && (
            <Chip tone="violet">{t("workspace.spec.phaseChip", { phase: arch.fase })}</Chip>
          )}
          {projectMetaChips(projectType, targetPlatforms).map((chip) => (
            <span key={chip.label} data-testid="arch-meta-chip">
              <Chip tone="slate" variant="plain">
                {chip.label}
              </Chip>
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
      icon="database"
      tone="blue"
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

function ArchitecturePlan({
  sourceErrors,
  workOrders,
  started,
  frds,
}: {
  readonly sourceErrors?: DigestSourceErrors;
  readonly workOrders: readonly WorkOrder[];
  readonly started: boolean;
  readonly frds: readonly { id: string; title: string }[];
}): React.JSX.Element {
  if (sourceErrors?.workOrderFiles?.length)
    return (
      <>
        <FileReadErrors errors={sourceErrors.workOrderFiles} />
        <PlanMosaic workOrders={workOrders} started={started} frds={frds} />
      </>
    );
  if (sourceErrors?.workOrders)
    return (
      <Notice icon="alert" kind="error">
        {sourceErrors.workOrders}
      </Notice>
    );
  return <PlanMosaic workOrders={workOrders} started={started} frds={frds} />;
}

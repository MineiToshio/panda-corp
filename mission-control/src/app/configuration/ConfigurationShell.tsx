"use client";

import { notFound } from "next/navigation";
import { SearchField } from "@/components/core/Field/Field";
import { Notice } from "@/components/core/Notice/Notice";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { Tabs } from "@/components/core/Tabs/Tabs";
import { t } from "@/lib/copy/copy";
import { updateNavigation, useUrlSearch, useUrlState } from "@/lib/navigation/useUrlState";
import type { ConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import { AgentsCatalog } from "./_components/AgentsCatalog";
import { CatalogDialog } from "./_components/CatalogDialog";
import { ConfigHub } from "./_components/ConfigHub";
import { type CatalogSection, ICONS, LABELS, SECTIONS, TONES } from "./_components/catalogViews";
import { RulesCatalog } from "./_components/RulesCatalog";
import { SkillsCatalog } from "./_components/SkillsCatalog";
import { StandardsCatalog } from "./_components/StandardsCatalog";
import styles from "./configuration.module.css";

/** Configuration's URL-controlled hub, catalogs, filters and native definitions. */
export function ConfigurationShell({
  catalogs,
}: {
  catalogs: ConfigurationCatalogs;
}): React.JSX.Element {
  const [section] = useUrlState("configSection", "summary");
  const [item, setItem] = useUrlState("configItem", "");
  const [query, setQuery] = useUrlSearch("q");
  const [type, setType] = useUrlState("type", "all");
  const [approval, setApproval] = useUrlState("approval", "all");
  const [severity, setSeverity] = useUrlState("severity", "all");
  const [domain, setDomain] = useUrlState("domain", "");
  function handleOpen(next: CatalogSection, id = ""): void {
    updateNavigation({ configSection: next, configItem: id || null, standardView: null });
  }
  function handleTab(next: string): void {
    updateNavigation({
      configSection: next === "summary" ? null : next,
      configItem: null,
      q: null,
      type: null,
      approval: null,
      severity: null,
      domain: null,
      standardView: null,
    });
  }
  if (!validSelection(section, type, approval, severity)) return notFound();
  const active = section as keyof typeof LABELS;
  const source = active === "summary" ? null : catalogs[active];
  const missingItem =
    item &&
    source?.ok &&
    !source.data.some((entry) => ("slug" in entry ? entry.slug : entry.id) === item);
  if (missingItem) return notFound();
  const searchKey = active === "summary" ? "hub" : active;
  return (
    <div data-testid="configuration-page" className={styles.page}>
      <PageHead title={t("configuracion.title")} subtitle={t("configuracion.subtitle")} />
      <Tabs
        tabs={(["summary", ...SECTIONS] as const).map((id) => ({
          id,
          label: t(LABELS[id]),
          tone: TONES[id],
          icon: ICONS[id],
          count: id === "summary" ? undefined : catalogs[id].ok ? catalogs.counts[id] : undefined,
        }))}
        active={active}
        onChange={handleTab}
        ariaLabel={t("configuracion.tabs.aria")}
        testIdPrefix="config-tab-"
        tabIdPrefix="config-tab-"
        panelIdPrefix="config-panel-"
      />
      <div
        role="tabpanel"
        id={`config-panel-${active}`}
        aria-labelledby={`config-tab-${active}`}
        className={styles.stack}
      >
        <SearchField
          label={
            active === "summary"
              ? t("configuracion.search.hubAria")
              : t(`configuracion.search.${searchKey}`)
          }
          placeholder={t(`configuracion.search.${searchKey}`)}
          value={query}
          onChange={setQuery}
        />
        <ReadErrors catalogs={catalogs} active={active} />
        {active === "summary" ? (
          <ConfigHub catalogs={catalogs} query={query} onOpen={handleOpen} />
        ) : null}
        {active === "skills" && catalogs.skills.ok ? (
          <SkillsCatalog
            skills={catalogs.skills.data}
            query={query}
            type={type}
            onType={setType}
            onOpen={(id) => handleOpen("skills", id)}
          />
        ) : null}
        {active === "agents" && catalogs.agents.ok ? (
          <AgentsCatalog
            agents={catalogs.agents.data}
            query={query}
            onOpen={(id) => handleOpen("agents", id)}
          />
        ) : null}
        {active === "rules" && catalogs.rules.ok ? (
          <RulesCatalog
            key={`${query}/${approval}`}
            rules={catalogs.rules.data}
            query={query}
            approval={approval}
            selected={item}
            onApproval={setApproval}
            onOpen={setItem}
          />
        ) : null}
        {active === "standards" && catalogs.standards.ok ? (
          <StandardsCatalog
            standards={catalogs.standards.data}
            domains={catalogs.domains}
            query={query}
            severity={severity}
            domain={domain}
            onSeverity={setSeverity}
            onDomain={setDomain}
            onOpen={(id) => handleOpen("standards", id)}
          />
        ) : null}
      </div>
      <CatalogDialog
        catalogs={catalogs}
        section={active}
        item={item}
        onOpen={handleOpen}
        onClose={() => setItem("")}
      />
    </div>
  );
}

function ReadErrors({
  catalogs,
  active,
}: {
  catalogs: ConfigurationCatalogs;
  active: string;
}): React.JSX.Element {
  return (
    <>
      {SECTIONS.filter((id) => (active === "summary" || active === id) && !catalogs[id].ok).map(
        (id) => {
          const failed = catalogs[id];
          return !failed.ok ? (
            <Notice key={id} icon="alert" kind="error">
              <code>{failed.source}</code>
              <p>{failed.reason}</p>
            </Notice>
          ) : null;
        },
      )}
    </>
  );
}

function validSelection(
  section: string,
  type: string,
  approval: string,
  severity: string,
): boolean {
  return (
    Object.hasOwn(LABELS, section) &&
    ["all", "owner", "internal"].includes(type) &&
    ["all", "auto", "human"].includes(approval) &&
    ["all", "MUST", "SHOULD", "MAY"].includes(severity)
  );
}

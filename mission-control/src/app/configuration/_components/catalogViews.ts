import type { CopyKey } from "@/lib/copy/copy";
import { t } from "@/lib/copy/copy";
import type { ConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";

export const SECTIONS = ["skills", "agents", "rules", "standards"] as const;
export type CatalogSection = (typeof SECTIONS)[number];
export const LABELS = {
  summary: "configuracion.tabs.resumen",
  skills: "configuracion.tabs.habilidades",
  agents: "configuracion.tabs.agentes",
  rules: "configuracion.tabs.reglas",
  standards: "configuracion.tabs.estandares",
} as const;
export const TONES = {
  summary: "slate",
  skills: "violet",
  agents: "blue",
  rules: "amber",
  standards: "teal",
} as const;
/** Case-insensitive search over source content, including complete definitions. */
export function matches(query: string, ...values: (string | null | undefined)[]): boolean {
  return values.join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
/** Standard source labels remain data; known domains use the UI catalogue. */
export function domainLabel(domain: string): string {
  const keys: Record<string, CopyKey> = {
    Programming: "configuracion.standards.domains.programming",
    Architecture: "configuracion.standards.domains.architecture",
    Design: "configuracion.standards.domains.design",
    Technology: "configuracion.standards.domains.technology",
    Quality: "configuracion.standards.domains.quality",
    Security: "configuracion.standards.domains.security",
    Operation: "configuracion.standards.domains.operation",
    "Data/Privacy": "configuracion.standards.domains.dataPrivacy",
    "Product/Docs": "configuracion.standards.domains.productDocs",
    Other: "configuracion.standards.domains.other",
  };
  return keys[domain] ? t(keys[domain]) : domain;
}
export function severityLabel(severity: string): string {
  if (severity === "MUST") return t("configuracion.standards.severityMust");
  if (severity === "MAY") return t("dialogs.account.adoption.optional");
  return t("configuracion.standards.severityShould");
}
export interface CatalogHit {
  section: CatalogSection;
  id: string;
  title: string;
  excerpt: string;
}
function excerpt(text: string, query: string): string {
  const index = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  const start = Math.max(0, index - 40);
  return text.slice(start, start + 180).replace(/\s+/g, " ");
}
/** Search all successful sources without interpreting an unreadable catalog as empty. */
export function searchCatalogs(catalogs: ConfigurationCatalogs, query: string): CatalogHit[] {
  const skillHits: CatalogHit[] = catalogs.skills.ok
    ? catalogs.skills.data
        .filter((item) => matches(query, item.slug, item.description, item.body))
        .map((item) => ({
          section: "skills",
          id: item.slug,
          title: `/pandacorp:${item.slug}`,
          excerpt: excerpt(`${item.description} ${item.body}`, query),
        }))
    : [];
  const agentHits: CatalogHit[] = catalogs.agents.ok
    ? catalogs.agents.data
        .filter((item) => matches(query, item.id, item.name, item.description, item.body))
        .map((item) => ({
          section: "agents",
          id: item.id,
          title: item.name ?? item.id,
          excerpt: excerpt(`${item.description ?? ""} ${item.body}`, query),
        }))
    : [];
  const ruleHits: CatalogHit[] = catalogs.rules.ok
    ? catalogs.rules.data
        .filter((item) => matches(query, item.id, item.patron, item.default, item.nota))
        .map((item) => ({
          section: "rules",
          id: item.id,
          title: item.id,
          excerpt: excerpt(`${item.patron} ${item.default} ${item.nota ?? ""}`, query),
        }))
    : [];
  const standardHits: CatalogHit[] = catalogs.standards.ok
    ? catalogs.standards.data
        .filter((item) => matches(query, item.id, item.title, item.body))
        .map((item) => ({
          section: "standards",
          id: item.id,
          title: item.title,
          excerpt: excerpt(item.body, query),
        }))
    : [];
  return [...skillHits, ...agentHits, ...ruleHits, ...standardHits];
}

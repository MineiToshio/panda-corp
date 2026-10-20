import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot } from "@/lib/config/config";
import type { ManualPage } from "@/lib/manual/manual";
import { readServiceCatalog } from "./services";
/** Generate public Manual recipes from the canonical catalog, never from private accounts. */
export function readServiceManualPages(factoryRoot = resolveFactoryRoot()): ManualPage[] {
  const { providers, issues } = readServiceCatalog(factoryRoot);
  const body = issues.length
    ? "El catálogo de servicios no está disponible o no cumple el contrato."
    : [
        "Recetas públicas del catálogo de la fábrica. Para identidades y vínculos, abre [Portafolio → Cuentas](/portfolio?portfolioView=accounts). Las fechas corresponden a documentación, no a una sesión activa.",
        ...providers.map((provider) =>
          [
            `## ${provider.name}`,
            `[Ver receta](/manual/guides/service-${provider.id})`,
            provider.purpose,
            `**Tipo:** ${provider.type}`,
            `[Abrir panel](${provider.dashboardUrl})`,
            `### Cómo reutilizarlo`,
            provider.reusePolicy,
            `### Ambientes`,
            provider.environmentPolicy,
            `### Automatización (${provider.automation.methods.join(" / ")})`,
            provider.automation.status,
            ...provider.automation.steps.map((step, index) => `${index + 1}. ${step}`),
            "### Cuotas y límites",
            provider.quotaNotes,
            "### Ejemplos de variables (sin secretos)",
            ...provider.variableExamples.map(variableRecipe),
            "### Fuentes",
            ...provider.sources.map(
              (source) => `- [Documentación](${source.url}) · ${source.checkedAt}`,
            ),
          ].join("\n\n"),
        ),
      ].join("\n\n");
  const pages: ManualPage[] = [
    ...providers.map((provider) => ({
      group: "guides",
      slug: `service-${provider.id}`,
      title: provider.name,
      order: 100,
      body: [
        provider.purpose,
        `## Cómo reutilizarlo`,
        provider.reusePolicy,
        `## Ambientes`,
        provider.environmentPolicy,
        `## Automatización`,
        provider.automation.status,
        ...provider.automation.steps.map((step, index) => `${index + 1}. ${step}`),
        `## Ejemplos de variables (sin secretos)`,
        ...provider.variableExamples.map(variableRecipe),
        `## Cuotas`,
        provider.quotaNotes,
        `[Abrir panel](${provider.dashboardUrl})`,
        ...provider.sources.map((source) => `[Fuente](${source.url}) · ${source.checkedAt}`),
      ].join("\n\n"),
    })),
    { group: "guides", slug: "services", title: "Servicios y cuentas", order: 90, body },
  ];
  const guidePath = path.join(factoryRoot, "plugin/docs/services-and-accounts.md");
  try {
    pages.push({
      group: "guides",
      slug: "services-operating-model",
      title: "Preparar y reutilizar servicios",
      order: 91,
      body: fs.readFileSync(guidePath, "utf8"),
    });
  } catch {
    pages.push({
      group: "guides",
      slug: "services-operating-model",
      title: "Preparar y reutilizar servicios",
      order: 91,
      body: "La guía operativa no está disponible. Revisar la instalación de la fábrica.",
    });
  }
  return pages;
}

function variableRecipe(
  example: import("./types").ServiceProvider["variableExamples"][number],
): string {
  return `- **${example.name}**: ${example.purpose}. Origen: ${example.source}. Destinos: ${example.targets.join(", ")}. ${example.secret ? "Secreto; el valor se mantiene fuera del directorio." : "Configuración pública."}${example.note ? ` ${example.note}` : ""}`;
}

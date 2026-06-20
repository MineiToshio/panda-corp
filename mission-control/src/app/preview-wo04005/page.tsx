/**
 * WO-04-005 preview route — visual fidelity check (DR-056).
 *
 * Renders TabSummary and TabDocuments with synthetic data so the implementer
 * can compare against the prototype's projResumen() / decisionesBox() / logBox()
 * / projDocs() patterns.
 *
 * Fidelity target: docs/design/prototype/index.html → projResumen() + projDocs().
 *
 * This file exists ONLY for the in-loop fidelity check — not shipping code.
 */

import { TabDocuments } from "@/app/projects/[slug]/_components/tab-documents/tab-documents";
import { TabSummary } from "@/app/projects/[slug]/_components/tab-summary/tab-summary";
import type { ActivityLog, DecisionPoint } from "@/lib/docs/activity";
import type { DocNode } from "@/lib/docs/tree";

// ---------------------------------------------------------------------------
// Synthetic data (mirrors prototype's hard-coded fixture data)
// ---------------------------------------------------------------------------

const SUMMARY =
  "Budget Buddy es una app web para registrar gastos personales de forma rápida y sin fricción.";

const KEY_POINTS = [
  "Stack: Next.js 15 + Tailwind v4 + Supabase",
  "Primera fase: MVP solo con registro y listado de gastos",
  "Sin autenticación en fase 1 — single-user local-first",
];

const ACTIVITY_LOG: ActivityLog = {
  entries: [
    "WO-01-001 VERIFIED — lib/gastos.ts listo y testeado",
    "WO-01-002 IN_REVIEW — GastoForm construido, esperando revisión",
    "La IA decidió usar Zod para validación de formularios",
    "Blueprinted FRD-02 — panel de listado con filtros",
  ],
};

const DECISIONS: DecisionPoint[] = [
  {
    title: "¿Usamos Supabase Auth o autenticación propia?",
    resolved: false,
    recommendation:
      "Supabase Auth — cero boilerplate, gratis en tier free, compatible con RLS. Implementar en Fase 2.",
  },
  {
    title: "¿El listado de gastos es infinito o paginado?",
    resolved: false,
    recommendation: "Paginación clásica — más simple, más predecible para MVP.",
  },
  {
    title: "Estructura de la tabla de gastos en Supabase",
    resolved: true,
    recommendation: "id, amount, category, description, date, created_at",
  },
];

const DOCS: DocNode[] = [
  { id: "docs/product/prd", label: "prd.md", group: "Product", relPath: "docs/product/prd.md" },
  {
    id: "docs/product/architecture",
    label: "architecture.md",
    group: "Product",
    relPath: "docs/product/architecture.md",
  },
  {
    id: "docs/frds/frd-01-gastos/frd",
    label: "frd.md",
    group: "Feature: frd-01-gastos",
    relPath: "docs/frds/frd-01-gastos/frd.md",
  },
  {
    id: "docs/frds/frd-01-gastos/blueprint",
    label: "blueprint.md",
    group: "Feature: frd-01-gastos",
    relPath: "docs/frds/frd-01-gastos/blueprint.md",
  },
  {
    id: "docs/decision-log",
    label: "decision-log.md",
    group: "Global",
    relPath: "docs/decision-log.md",
  },
];

const SAMPLE_DOC_CONTENT = `# PRD — Budget Buddy

## Visión

Registrar un gasto personal en menos de 10 segundos, desde el móvil o el escritorio,
sin cuentas ni fricción.

## Métricas de éxito

- Tiempo promedio para registrar un gasto < 10s
- Retention D7 > 40%
- NPS > 50 en beta cerrada

## Alcance del MVP

1. Registro rápido de gasto (monto + categoría + descripción opcional)
2. Listado paginado de gastos recientes
3. Exportar a CSV

## Fuera de alcance (Fase 1)

- Autenticación / multi-usuario
- Gráficos / reportes avanzados
- Integración bancaria
`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PreviewPage() {
  const pendingDecisions = DECISIONS.filter((d) => !d.resolved).length;

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h2
        style={{
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "8px",
          color: "var(--color-text2)",
        }}
      >
        WO-04-005 — TabSummary + TabDocuments Preview (vs prototype projResumen() / projDocs())
      </h2>
      <p
        style={{
          fontSize: "12px",
          color: "var(--color-text3, var(--color-text2))",
          marginBottom: "24px",
        }}
      >
        Fidelity target:{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          docs/design/prototype/index.html → projResumen() + decisionesBox() + logBox() + projDocs()
        </code>
      </p>

      {/* Section 1: TabSummary — full data (decisions + log + key points) */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          1. RESUMEN TAB — full data ({pendingDecisions} pending decisions, activity log, key
          points)
        </p>
        <TabSummary
          summary={SUMMARY}
          keyPoints={KEY_POINTS}
          activityLog={ACTIVITY_LOG}
          decisions={DECISIONS}
          pendingDecisions={pendingDecisions}
        />
      </div>

      {/* Section 2: TabSummary — empty state */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          2. RESUMEN TAB — empty state (no decisions, no log)
        </p>
        <TabSummary
          summary={SUMMARY}
          keyPoints={[]}
          activityLog={{ entries: [] }}
          decisions={[]}
          pendingDecisions={0}
        />
      </div>

      {/* Section 3: TabDocuments — with nav + selected doc */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          3. DOCUMENTOS TAB — nav + markdown body (first doc selected)
        </p>
        <TabDocuments nodes={DOCS} selectedId={DOCS[0]?.id ?? null} content={SAMPLE_DOC_CONTENT} />
      </div>

      {/* Section 4: TabDocuments — loading state */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          4. DOCUMENTOS TAB — loading state (nodes present, content null)
        </p>
        <TabDocuments nodes={DOCS} selectedId={DOCS[0]?.id ?? null} content={null} />
      </div>

      {/* Section 5: TabDocuments — empty state */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          5. DOCUMENTOS TAB — empty state (no docs)
        </p>
        <TabDocuments nodes={[]} selectedId={null} content={null} />
      </div>
    </div>
  );
}

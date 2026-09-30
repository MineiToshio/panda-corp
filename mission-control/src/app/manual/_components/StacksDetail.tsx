/**
 * manual/_components/StacksDetail.tsx — FRD-08 "Stacks · golden paths" detail
 *
 * The layers of golden path A, the specifics of B and C, how a stack gets chosen,
 * Mission Control's own stack and the DR-001 dependency policy. Composed by
 * `ConceptStacks` in manualPages.tsx, the only source the reader renders for this
 * slug. Canonical source: factory/standards/stack.md.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { ProseTable } from "@/components/modules/manual-diagrams/ProseTable";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";

const PATH_A_ROWS: readonly (readonly string[])[] = [
  ["Framework", "Next.js (App Router) + React"],
  ["Lenguaje", "TypeScript strict"],
  ["Estilos", "Tailwind + design tokens (shadcn/ui como base de componentes)"],
  ["Base de datos", "Postgres en Neon (Supabase evaluado y rechazado)"],
  ["Auth", "Better Auth"],
  ["ORM", "Prisma (data layer en queries/)"],
  ["Tests", "Vitest + Testing Library + Playwright (e2e)"],
  ["Lint y formato", "Biome"],
  ["Despliegue", "Vercel (web)"],
  ["Secretos", "SOPS + age"],
  ["Pagos", "Polar"],
  ["Analítica", "PostHog + Sentry"],
];

/** Sections below the golden-path cards: A in detail, B/C, selection, MC, dependencies. */
export function StacksDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="A · Web full-stack, capa por capa" />
      <Body margin="0 0 8px">
        Es el default, validado en producción y definido en <Code>factory/standards/stack.md</Code>.
        Siempre en las últimas versiones estables.
      </Body>
      <ProseTable
        label="Capas del golden path A y su tecnología"
        columns={["Capa", "Tecnología"]}
        rows={PATH_A_ROWS}
        monoColumns={[]}
      />

      <DocH title="B · API o servicio TypeScript" />
      <Body>
        <B weight={500}>Hono</B> (corre en Node, Bun o Workers) + Zod en cada boundary + OpenAPI{" "}
        <B weight={500}>derivado de los schemas</B> + Drizzle + Postgres (Neon). Deploy: contenedor
        en Railway o Fly. Solo para servicios headless (webhooks, gateways, APIs para clientes
        externos): la API de una web app vive en los route handlers del path A.
      </Body>

      <DocH title="C · Datos, scraping y APIs Python" />
      <Body>
        Python 3.12 + <B weight={500}>uv</B> + ruff + mypy strict + <B weight={500}>FastAPI</B> +
        Pydantic v2 + SQLAlchemy/Alembic. Para scraping: httpx + parsel (Playwright{" "}
        <B weight={500}>solo</B> para páginas con JS), cola ARQ/Redis y scraping responsable
        obligatorio (robots.txt, rate limiting propio, user-agent identificable).
      </Body>

      <DocH title="Puntos de partida (aún sin validar en producción)" />
      <Body>
        Para casos que todavía no han construido un proyecto real: <B weight={500}>CLI</B>{" "}
        (Commander o Typer), <B weight={500}>extensión de navegador</B> (WXT),{" "}
        <B weight={500}>sitio estático</B> (Astro) y <B weight={500}>app de agentes IA</B> (Claude
        Agent SDK para agentes autónomos; Vercel AI SDK para features de IA dentro de una web). El
        primer build real los endurece a golden path completo.
      </Body>

      <DocH title="Cómo se elige el stack" />
      <Ul>
        <li>El architect analiza los requisitos del proyecto.</li>
        <li>
          Propone el stack en <Code>docs/product/architecture.md</Code>, justificando cualquier
          desviación del golden path.
        </li>
        <li>El propietario lo aprueba: es el gate de arquitectura.</li>
        <li>
          La decisión queda registrada como ADR en <Code>docs/adr/</Code>.
        </li>
      </Ul>
      <NotePanel icon="ti-info-circle">
        Usar el golden path no es obligatorio: el architect puede proponer alternativas si hay
        razones técnicas sólidas, pero debe justificarlas y tú debes aprobarlas.
      </NotePanel>

      <DocH title="Para Mission Control específicamente" />
      <Body margin="0 0 8px">
        Mission Control es un caso especial: vive dentro de la fábrica, no se despliega a producción
        y es una herramienta personal, no un producto. Su stack sigue el golden path web con estas
        particularidades:
      </Body>
      <Ul>
        <li>No tiene base de datos: lee el sistema de archivos de la fábrica.</li>
        <li>No tiene auth: es una herramienta local que escucha solo en 127.0.0.1.</li>
        <li>No tiene pagos ni analítica de producto.</li>
        <li>Se ejecuta en local, sin deploy.</li>
      </Ul>

      <DocH title="Dependencias y DR-001" />
      <Body margin="0 0 8px">
        Añadir una dependencia nueva requiere aprobación implícita o explícita según DR-001:
      </Body>
      <Ul>
        <li>
          <B weight={500}>Aprobadas:</B> las del stack por defecto y sus ecosistemas documentados.
        </li>
        <li>
          <B weight={500}>Nuevas:</B> el agente justifica la necesidad y el propietario las aprueba
          antes de instalarlas.
        </li>
        <li>
          <B weight={500}>Prohibidas:</B> librerías con CVEs conocidos, sin mantenimiento en los
          últimos 12 meses, o que dupliquen funcionalidad ya aprobada.
        </li>
      </Ul>

      <DocH title="Por qué golden paths" />
      <Body>
        La consistencia entre proyectos reduce el costo de contexto de los agentes: no tienen que
        redescubrir las mismas convenciones, y un agente que ya construyó varios proyectos con el
        mismo stack arranca uno nuevo sin fricción de setup.
      </Body>
    </>
  );
}

/**
 * manual/_components/CockpitDetail.tsx — FRD-08 "Mission Control por dentro" detail
 *
 * Sections, project tabs, idea-card tabs, the read modules, the stats read-model,
 * the Party panel and the design invariants. Composed by `ConceptCockpit` in
 * manualPages.tsx, the only source the reader renders for this slug.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { ProseTable } from "@/components/modules/manual-diagrams/ProseTable";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";

const SECTION_ROWS: readonly (readonly string[])[] = [
  ["Inicio", "/", "Tablero de ideas en columnas Kanban"],
  ["Proyecto", "/projects/[slug]", "Estado detallado de un proyecto activo"],
  ["Portfolio", "/portfolio", "Lista de todos los proyectos con su fase"],
  ["Manual", "/manual", "Esta documentación navegable"],
  ["Configuración", "/configuration", "Skills, agentes, reglas y estándares derivados"],
];

const READ_MODULE_ROWS: readonly (readonly string[])[] = [
  [
    "lib/portfolio/ · lib/status/",
    "factory/portfolio.md + .pandacorp/status.yaml de cada proyecto",
  ],
  ["lib/ideas/", "factory/ideas/*.md"],
  ["lib/work-orders/", "docs/frds/*/work-orders/*.md del proyecto"],
  [
    "lib/architecture/",
    ".pandacorp/comms/arquitectura-resumen.md + docs/adr/* + .env.example (pestaña Arquitectura)",
  ],
  ["lib/events/", "~/.claude/dashboard-events.ndjson"],
  ["lib/reference/", "plugin/skills/*/SKILL.md + plugin/agents/*.md"],
  ["lib/registry/", "factory/decisions/registry.yaml"],
  ["lib/standards/", "factory/standards/*.md"],
  ["lib/manual/", "content/manual/**/*.md (el índice de este Manual: título, grupo y orden)"],
];

/** Sections below the data diagram: what each screen shows and how it reads data. */
export function CockpitDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Secciones principales" />
      <ProseTable
        label="Secciones de Mission Control y su ruta"
        columns={["Sección", "Ruta", "Qué muestra"]}
        rows={SECTION_ROWS}
        monoColumns={[1]}
      />

      <DocH title="La sección de Proyecto" />
      <Body margin="0 0 8px">Cada proyecto tiene una página con pestañas:</Body>
      <Ul>
        <li>
          <B weight={500}>Comandos:</B> los comandos recomendados para la fase actual, con botón de
          copia.
        </li>
        <li>
          <B weight={500}>Work Orders:</B> tablero Kanban de work orders (PLANNED / IN_PROGRESS /
          IN_REVIEW / VERIFIED / BLOCKED).
        </li>
        <li>
          <B weight={500}>Party:</B> los agentes del equipo animados con su estado en tiempo real.
        </li>
        <li>
          <B weight={500}>Observabilidad:</B> el{" "}
          <B weight={500}>grafo de dependencias entre work orders</B> en 2D (cada FRD es una caja
          con sus work orders dentro; las dependencias internas WO a WO y las dependencias entre
          FRDs agregadas en una línea FRD a FRD; al hacer clic en un WO se resaltan sus relaciones
          con colores), el freshness badge y la{" "}
          <B weight={500}>línea de tiempo de la construcción</B> (FRD, work order y revisión, con
          duraciones reales del track durable <Code>.pandacorp/track.jsonl</Code>). Si el proyecto
          no tiene track, se reconstruye del historial de git con duraciones{" "}
          <B weight={500}>estimadas</B> bajo bandera honesta, y si tampoco hay commits de build,
          muestra una vista estructural sin duraciones.
        </li>
        <li>
          <B weight={500}>Documentos:</B> navegador de los documentos del proyecto (
          <Code>docs/frds/</Code>, <Code>docs/product/</Code>).
        </li>
      </Ul>

      <DocH title="La card de una idea (en el tablero)" />
      <Body margin="0 0 8px">
        Al hacer clic en una idea del tablero se abre su detalle, también con pestañas. Las dos
        primeras son nativas (renderizadas con el diseño de Pandacorp, no un visor de markdown) y
        aparecen <B weight={500}>según la fase</B> del proyecto:
      </Body>
      <Ul>
        <li>
          <B weight={500}>Propuesta:</B> el memo-pitch de caliente a frío de la idea (la pestaña por
          defecto).
        </li>
        <li>
          <B weight={500}>Spec:</B> resumen visual del PRD, el research y los FRDs; aparece cuando
          existe <Code>.pandacorp/comms/spec-resumen.md</Code> (fase product en adelante).
        </li>
        <li>
          <B weight={500}>Arquitectura:</B> resumen visual de la arquitectura; aparece cuando existe{" "}
          <Code>.pandacorp/comms/arquitectura-resumen.md</Code> (fase architecture en adelante). Una
          sola pantalla con el stack, el modelo de datos (con la rama «Sin BD»), la comunicación y
          los servicios, las <B weight={500}>variables de entorno</B> y los <B weight={500}>ADRs</B>{" "}
          (leídos en vivo de <Code>.env.example</Code> y <Code>docs/adr/</Code>), el{" "}
          <B weight={500}>plan de implementación</B> como grafo DAG de las work orders (el mismo DAG
          de Observabilidad) y una ficha por FRD con su blueprint, sus work orders y, si tiene más
          de una, su sub-DAG de dependencias.
        </li>
        <li>
          <B weight={500}>Documentos:</B> navegador de los documentos del proyecto.
        </li>
        <li>
          <B weight={500}>Campaña:</B> la vista «La Campaña», con la fase activa y el siguiente
          comando.
        </li>
      </Ul>

      <DocH title="Cómo lee los datos" />
      <Body margin="0 0 8px">
        Mission Control lee el sistema de archivos de la fábrica directamente: no tiene base de
        datos propia. Los módulos de lectura viven en <Code>src/lib/</Code>, y todo son lecturas
        puras: sin escrituras y sin llamadas a la API de Claude.
      </Body>
      <ProseTable
        label="Módulos de lectura de Mission Control y qué leen"
        columns={["Módulo", "Qué lee"]}
        rows={READ_MODULE_ROWS}
      />

      <DocH title="El Informe de Logros y el read-model materializado" />
      <Body>
        El Informe (la pestaña Estadísticas de Logros) muestra métricas históricas: work orders
        verificadas por semana, transiciones de fase, commits, decisiones y lecciones. Ese histórico
        no está en ninguna base de datos: la única fuente del <i>cuándo</i> es la historia de git.
        Derivarla leyendo git en cada carga no escala (cuesta más con cada proyecto), así que usa un{" "}
        <B weight={500}>read-model materializado</B> (FRD-23): un archivo con los números ya
        calculados que Mission Control solo lee, en lugar de recorrer git en cada navegación.
      </Body>
      <Ul>
        <li>
          <B weight={500}>Portada por proyecto</B> (
          <Code>&lt;proyecto&gt;/.pandacorp/stats.json</Code>
          ): los hechos de ese proyecto (weeklyFlow, sus scalars, funnel), validados por el sello
          del proyecto.
        </li>
        <li>
          <B weight={500}>Store de la fábrica</B> (
          <Code>&lt;raíz&gt;/.pandacorp/stats-factory.json</Code>
          ): los hechos de toda la fábrica (transiciones de fase de todos los proyectos, número de
          proyectos, decisiones, lecciones), con su propio sello factory-wide.
        </li>
      </Ul>
      <Body margin="10px 0 0">
        Cada sello (el hash del último commit que toca sus fuentes) valida exactamente lo que su
        archivo contiene. Si el sello no coincide, o el archivo falta o está corrupto, Mission
        Control cae al lector de git en vivo para ese dato: nunca inventa un cero (contrato
        fail-loud, DR-078). El archivo se genera una vez, en un punto seguro (un solo escritor,
        escritura atómica), nunca con sumas incrementales; así el costo de git se paga cuando un
        proyecto cambia, no en cada clic tuyo.
      </Body>
      <NotePanel icon="ti-info-circle">
        La materialización se activa cuando se generan los archivos por primera vez:{" "}
        <Code>pnpm stats:backfill</Code> para las portadas por proyecto y{" "}
        <Code>pnpm stats:factory</Code> para el store de la fábrica. Mientras no existan, corre por
        el camino en vivo, que va bien con pocos proyectos. Detalle técnico en{" "}
        <Code>docs/frds/frd-23-materialized-stats-read-model/</Code> y ADR-0004.
      </NotePanel>

      <DocH title="El Party panel" />
      <Body margin="0 0 8px">
        Muestra a los agentes del equipo con avatares pixel-art animados. Los eventos llegan desde{" "}
        <Code>~/.claude/dashboard-events.ndjson</Code> (un archivo NDJSON al que escriben los
        agentes y los hooks). El panel usa un loop de animación para cinco estados:
      </Body>
      <Ul>
        <li>
          <B weight={500}>Breathing:</B> movimiento de reposo cuando el agente está activo.
        </li>
        <li>
          <B weight={500}>Wander:</B> deambulación aleatoria en su zona.
        </li>
        <li>
          <B weight={500}>Handoff:</B> animación de traspaso entre agentes cuando pasan una work
          order.
        </li>
        <li>
          <B weight={500}>Achievement:</B> celebración al completar una work order.
        </li>
        <li>
          <B weight={500}>Down:</B> postura de error cuando hay un fallo.
        </li>
      </Ul>

      <DocH title="El Manual (esta página)" />
      <Body>
        El Manual sigue la estructura Diátaxis: Tutorial, Guías, Referencia y Conceptos. Los
        catálogos de Referencia (comandos, agentes, reglas, estándares) se derivan de la fuente
        canónica en cada render, nunca se copian a mano (DR-046). Las páginas de Tutorial, Guías y
        Conceptos se componen en React (<Code>src/app/manual/manualPages.tsx</Code>) y su archivo{" "}
        <Code>.md</Code> en <Code>content/manual/</Code> solo aporta título, grupo y orden al menú.
      </Body>

      <DocH title="Invariantes de diseño" />
      <Ul>
        <li>
          <B weight={500}>Solo lectura:</B> Mission Control nunca ejecuta código ni llama a Claude.
          Sus únicas escrituras son las de una tarjeta de idea: descartarla o restaurarla (
          <Code>status:</Code>) y marcarla como favorita.
        </li>
        <li>
          <B weight={500}>Design tokens únicamente:</B> todo color, espaciado y tipografía viene de{" "}
          <Code>docs/design/design-tokens.json</Code>.
        </li>
        <li>
          <B weight={500}>Server Components por defecto:</B> <Code>&quot;use client&quot;</Code>{" "}
          solo cuando la interactividad lo requiere (estado, eventos del navegador).
        </li>
        <li>
          <B weight={500}>Sin copias escritas a mano:</B> los catálogos de Referencia se derivan de
          su fuente canónica en cada render.
        </li>
      </Ul>
    </>
  );
}

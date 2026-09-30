/**
 * manual/_components/EstadoDetail.tsx — FRD-08 "Estado y archivos" detail
 *
 * The language rule by git status, the shape of the two state files every project
 * carries (status.yaml, work-order frontmatter), the feeds (progress log, events,
 * durable track), the memory store and secrets. Composed by `ConceptEstado` in
 * manualPages.tsx, the only source the reader renders for this slug.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import {
  B,
  Body,
  Code,
  MonoBlock,
  NotePanel,
  Ul,
} from "@/components/modules/manual-diagrams/prose";

const STATUS_SAMPLE = `phase: build                    # fase actual del pipeline
version: "1.0.0"                # versión semántica
overlay_version: "8.5.0"        # versión del overlay Pandacorp
last_green_sha: abc1234         # SHA del último commit con verify.sh verde
safe_to_test: true              # hay snapshot verificado; HEAD es ese snapshot o su hijo de metadatos
running: false                  # si el motor de implement está activo
blocked_work_orders: []         # work orders bloqueadas esperando desbloqueo`;

const WORK_ORDER_SAMPLE = `implementation_status: IN_REVIEW   # PLANNED | IN_PROGRESS | IN_REVIEW | VERIFIED | BLOCKED
artifacts: [src/lib/foo.ts]        # archivos que esta WO escribe (DR-060 serializa las que se solapan)
dependsOn: [WO-01-000, WO-01-001]  # WOs de las que depende (DR-087): la fuente del grafo`;

/** Sections below the state table: language rule, the two state files, feeds, secrets. */
export function EstadoDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="La regla del idioma" />
      <Body margin="0 0 8px">
        El idioma de un archivo lo decide si está versionado o en gitignore:
      </Body>
      <Ul>
        <li>
          <B weight={500}>Committed, en inglés:</B> código, commits y documentos técnicos (PRD, FRD,
          blueprint, ADR, README, tests, <Code>docs/decision-log.md</Code>).
        </li>
        <li>
          <B weight={500}>Gitignoreado, en español:</B> la capa de comunicación con el propietario (
          <Code>.pandacorp/comms/</Code>, <Code>.pandacorp/inbox/</Code>) y los datos personales (
          <Code>factory/profile.md</Code>, <Code>factory/portfolio.md</Code>,{" "}
          <Code>factory/ideas/*.md</Code>).
        </li>
      </Ul>

      <DocH title="Estado del proyecto: .pandacorp/status.yaml" />
      <Body margin="0 0 8px">
        El archivo más importante de un proyecto. Mission Control lo lee para mostrar la fase y el
        estado en el portfolio y en la página de proyecto.
      </Body>
      <MonoBlock text={STATUS_SAMPLE} />

      <DocH title="Work orders: el estado vive en su frontmatter" />
      <Body margin="0 0 8px">
        Cada work order (
        <Code>docs/frds/frd-NN-&lt;slug&gt;/work-orders/wo-NN-MMM-&lt;slug&gt;.md</Code>) lleva su
        estado en el frontmatter:
      </Body>
      <MonoBlock text={WORK_ORDER_SAMPLE} />
      <Body margin="10px 0 0">
        El motor de <Code>implement</Code> actualiza <Code>implementation_status</Code> al avanzar
        la work order y Mission Control lo lee para el tablero Kanban. <Code>dependsOn</Code>{" "}
        declara las dependencias reales hacia otras work orders (varias, incluso de otros FRDs;{" "}
        <Code>[]</Code> si es raíz) y es lo que lee el grafo de dependencias de Observabilidad. No
        se fabrica una cadena lineal: una work order sin predecesor real es un nodo independiente.
      </Body>

      <DocH title="Comunicación con builds en marcha" />
      <Ul>
        <li>
          <Code>.pandacorp/inbox/changes/</Code> (gitignoreado): dejar un archivo aquí es suficiente
          para pedir un cambio o reportar un bug a un <Code>implement</Code> en ejecución; el motor
          lo recoge en el próximo safe point.
        </li>
        <li>
          <Code>.pandacorp/inbox/decisions.md</Code> (gitignoreado): las decisiones pendientes se
          listan aquí y <Code>/pandacorp:decide</Code> las lleva al registro de decisiones.
        </li>
        <li>
          <Code>.pandacorp/comms/progress.md</Code>: el log de avance en español, el{" "}
          <B weight={500}>feed de hitos</B> que Mission Control muestra en la pestaña Resumen. No es
          un log de CI: cada entrada es un hito que le importa al propietario (un FRD o WO
          construido o cambiado, una decisión tomada, un bloqueo que te necesita), nunca la salida
          cruda de una herramienta de gate. El resultado de cada gate es evidencia interna del
          reviewer y del motor; si hay que conservarlo va a un log técnico bajo{" "}
          <Code>.pandacorp/run/</Code>. Contrato completo en{" "}
          <Code>factory/standards/build-orchestration.md</Code> §7.
        </li>
        <li>
          <Code>.pandacorp/comms/iteration.md</Code>: persistencia de la conversación de diseño y
          spec con el propietario; permite retomar aunque se pierda el contexto de la sesión.
        </li>
      </Ul>

      <DocH title="Eventos del Party: ~/.claude/dashboard-events.ndjson" />
      <Body>
        Un archivo NDJSON en tu directorio home al que escriben los agentes y los hooks cuando
        terminan acciones relevantes. Mission Control lo lee para el panel Party y los KPIs en
        tiempo real. No está versionado (es del usuario local) y <B weight={500}>rota</B>: se lee la
        cola.
      </Body>

      <DocH title="La línea de tiempo durable: .pandacorp/track.jsonl" />
      <Body>
        A diferencia del archivo de eventos (efímero y global), el motor de build escribe un{" "}
        <B weight={500}>registro durable por proyecto</B> en <Code>.pandacorp/track.jsonl</Code>:
        una línea por transición (<Code>wo_start</Code>, <Code>wo_end</Code>,{" "}
        <Code>review_start</Code>/<Code>review_end</Code>, <Code>frd_end</Code>). Es estado-máquina
        versionado (como <Code>status.yaml</Code>, lo commitea el motor), así que sobrevive al
        build, y es la fuente de Observabilidad → Línea de tiempo con duraciones reales. Solo lo
        tienen los proyectos construidos con el motor que lo escribe; para los anteriores la línea
        de tiempo se reconstruye del historial de git (el orden, las fechas y los resultados son
        reales; las duraciones son <B weight={500}>estimadas</B> del tiempo entre commits, bajo una
        bandera «≈ tiempos estimados») y, si tampoco hay commits de build, cae a una vista
        estructural sin duraciones.
      </Body>

      <DocH title="La memoria de la fábrica: factory/memory/" />
      <Body>
        Lecciones duraderas cosechadas de los proyectos. Están versionadas (committed, en inglés)
        porque son know-how de la fábrica, no datos personales. El inbox de memoria es gitignoreado:
        solo las lecciones promovidas se commitean.
      </Body>

      <NotePanel icon="ti-key" iconColor="var(--color-warn)">
        <B weight={600}>Secretos.</B> Nunca están en ningún archivo versionado: se inyectan por
        variables de entorno o con un gestor de secretos (SOPS + age), y el <Code>.gitignore</Code>{" "}
        de cada proyecto excluye <Code>.env*</Code> por defecto.
      </NotePanel>
    </>
  );
}

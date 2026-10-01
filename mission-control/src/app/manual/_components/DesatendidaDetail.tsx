/**
 * manual/_components/DesatendidaDetail.tsx — FRD-08 "Construcción desatendida" detail
 *
 * The reference part of the unattended-build concept page: how a run stops and
 * resumes, how the owner talks to a running build, and the engine's `args.*` with
 * their defaults. Composed by `ConceptDesatendida` in manualPages.tsx, which is the
 * ONLY source the reader renders for this slug (the `.md` is an index stub).
 * Canonical source of the args: factory/standards/build-orchestration.md.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { ProseTable } from "@/components/modules/manual-diagrams/ProseTable";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";

const ENGINE_ARGS_COLUMNS = ["args.*", "Por defecto", "Qué hace", "Cuándo cambiarlo"] as const;

const ENGINE_ARGS_ROWS: readonly (readonly string[])[] = [
  [
    "forceUiPasses",
    "false",
    "Fuerza que corran siempre los pases que tocan UI (foundation-gate, visual-qa), ignorando los artefactos declarados por las work orders.",
    "Si sospechas que un cambio visual se coló sin pasar por el gate de UI.",
  ],
  [
    "leanCloseOut",
    "true",
    "Funde el archivado de changes y la liberación de la lease en el agente de cierre, y resuelve visual-qa como una promesa antes de la cadena de hardening.",
    "Rara vez: es una optimización de costo interna, no cambia el resultado.",
  ],
  [
    "strictBaseline",
    "false",
    "Trata cualquier ruta sucia (que no sea status.yaml) bajo una lease válida como una escalada, no como un baseline limpio.",
    "Si quieres que el motor sea más estricto ante cualquier archivo modificado inesperado al arrancar.",
  ],
  [
    "safePointEveryWave",
    "false",
    "Fuerza el safe point completo en cada oleada, incluso en un run dirigido (por FRD o por change).",
    "Si quieres puntos de recuperación más frecuentes en un build dirigido, a cambio de más costo.",
  ],
  [
    "mechLean",
    "true",
    "Enruta los pasos mecánicos del motor (commits, dispatch stamps, sync de rollups) a través del agente mech, más barato.",
    "Rara vez: desactivarlo vuelve a los pasos mecánicos previos al sprint.",
  ],
  [
    "repairBudgetFactor",
    "3",
    "Tope de gasto en reparación acotada (scoped repair), como múltiplo del costo ponderado del build, antes de que el motor se rinda honestamente a needs-owner.",
    "Si quieres que el motor insista más (o menos) antes de escalar un bloqueo.",
  ],
  [
    "scopedRepair",
    "false",
    "Permite que un rojo puramente mecánico en un sub-gate se repare con --only/--files en vez de un ciclo de parche a todo el proyecto.",
    "Se activa solo tras pasar su canario de validación: todavía no es un flag para tocar a mano.",
  ],
  [
    "gateEvidence",
    "'explore'",
    "Modo de evidencia del gate: 'explore' (idéntico byte a byte al gate anterior al sprint) o 'digested' (evidencia recolectada por el agente mech, con presupuesto de exploración acotado).",
    "Se queda en 'explore': los canarios F1/F2 midieron que 'digested' pierde hallazgos reales incluso con el Drift Finder ayudando, así que todavía no se recomienda.",
  ],
  [
    "driftFinder",
    "según gateEvidence",
    "Enciende al Drift Finder junto a cada gate de FRD: por defecto encendido con 'digested' y apagado con 'explore'.",
    "--drift-finder on|off en el launcher: on lo fuerza también con 'explore'; off lo apaga.",
  ],
  [
    "gateContextScope",
    "false",
    "Acota lo que el gate lee en completo (el frd.md y las work orders de este ciclo) y deja el resto como punteros.",
    "Todavía sin medir: déjalo apagado.",
  ],
  [
    "gateInventoryCache",
    "false",
    "Reutiliza el inventario de contratos del FRD mientras su frd.md y su blueprint no cambien.",
    "Todavía sin medir: déjalo apagado.",
  ],
  [
    "drainOnEmptyPlan",
    "true",
    'En un run sin objetivo (bare) con el plan vacío, drena la cola de changes listas antes de declarar "nada que construir".',
    "Ponlo en false si quieres que un run bare con plan vacío no toque la cola de changes.",
  ],
  [
    "parallelGates",
    "true (desde 9.116.0)",
    "Deja que hasta gateSlots FRDs se revisen a la vez, cada uno fijado a su propio worktree, con el aterrizaje a main siempre serializado.",
    "Se apaga con --no-parallel-gates (launcher) si prefieres el camino de un solo worktree de antes del sprint.",
  ],
  [
    "gateSlots",
    "2",
    "Cuántos gates pueden correr a la vez cuando parallelGates está activo.",
    "Súbelo solo en una máquina con más memoria que la de referencia (16 GB); si lo subes, sube también maxAgents (regla práctica medida: unas 8 de base, 4 a 6 por work order y unas 20 por FRD a revisar).",
  ],
  [
    "driftPolicy",
    "'record'",
    "Qué hacer con una deriva encontrada en un FRD ya verificado: 'record' nunca bloquea el gate actual, anota drift: en el FRD y abre una tarjeta en la cola de cambios para que decidas; solo un ciclo real (el contrato ya verificado ahora se rompe de verdad) reabre la work order.",
    "'block' es el interruptor de reversa si alguna vez quieres que una deriva detenga el gate.",
  ],
];

/** The reference sections of the unattended-build page (principle → args → restart). */
export function DesatendidaDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="El principio" />
      <Body>
        El motor de <Code>implement</Code> es un <B weight={500}>Dynamic Workflow</B>: un script
        determinista que orquesta subagentes con dependencias explícitas. Una vez lanzado no
        necesita intervención humana para avanzar. Puedes cerrar la sesión y retomar más tarde: el
        build continúa desde el último safe point y nunca pierde trabajo completado.
      </Body>

      <DocH title="Cómo se le ordena parar" />
      <Body>
        La orden de parar tampoco depende del shell. Antes de cada oleada el motor exige un recibo
        cercado producido por <Code>stateCli inspect-stop</Code>; por eso un alias como{" "}
        <Code>test=npm test</Code> no puede simular que existe el archivo de parada. Si el recibo
        falla o llega incompleto, el run se detiene de forma segura en vez de adivinar que no hay
        una orden pendiente.
      </Body>
      <NotePanel icon="ti-alert-triangle" iconColor="var(--color-warn)">
        <B weight={500}>Límite honesto de la plataforma.</B> En Claude, el Dynamic Workflow no tiene
        acceso directo al filesystem ni a procesos: un subagente Claude ejecuta{" "}
        <Code>inspect-stop</Code> y transporta el recibo. La validación fail-closed y la
        calificación en vivo prueban el camino real esperado, pero no convierten esa frontera en una
        garantía criptográfica. El hardening futuro está registrado en BL-0074 y no bloquea el
        relevo en frío hacia el ejecutor separado de Codex, que nunca consume la narración de ese
        subagente.
      </NotePanel>

      <DocH title="Comunicarte con una construcción en marcha" />
      <Body margin="0 0 8px">
        Nunca interrumpes al agente directamente: la comunicación es{" "}
        <B weight={500}>asíncrona, a través de archivos</B>. El motor revisa estos canales en cada
        safe point, nunca a mitad de una work order.
      </Body>
      <Ul>
        <li>
          <Code>.pandacorp/inbox/changes/</Code>: la cola de cambios, donde{" "}
          <Code>/pandacorp:change</Code> deja un bug, una feature o un ajuste (un bug es una tarjeta
          de tipo <Code>bug</Code>).
        </li>
        <li>
          <Code>.pandacorp/inbox/decisions.md</Code>: las decisiones pendientes de resolver con{" "}
          <Code>/pandacorp:decide</Code>.
        </li>
        <li>
          <Code>rethink_pending: true</Code> en <Code>status.yaml</Code>: señal para que el motor
          replantee el plan en el próximo safe point.
        </li>
      </Ul>

      <DocH title="Paralelismo: oleadas globales" />
      <Body>
        Cada oleada toma las work orders <B weight={500}>listas de todos los FRDs</B> (con sus
        dependencias <Code>dependsOn</Code> satisfechas y artefactos que no se pisan) hasta el tope
        del modo: en potente, 8 en paralelo. Ya no se espera a que termine un FRD para empezar el
        siguiente, así que seis features independientes se construyen a la vez. Las dependencias son
        explícitas en el frontmatter de cada work order; no se infieren. Los gates de review siguen
        siendo uno por FRD y, desde 9.116.0, corren en paralelo por defecto con el aterrizaje a main
        siempre de uno en uno.
      </Body>

      <DocH title="Los args del motor" />
      <Body margin="0 0 8px">
        El sprint de velocidad de 2026-09-22 (plugin 9.103.0) añadió una serie de flags al motor de{" "}
        <Code>implement</Code>, y el sprint de canarios F1/F2 (2026-09-26, plugin 9.116.0) sumó los
        de paralelismo de gates y política de deriva. Todos tienen un valor por defecto elegido por
        el motor: normalmente no los tocas, pero conviene saber qué hace cada uno si algo se
        comporta distinto a lo esperado.
      </Body>
      <ProseTable
        label="Args del motor de implement, con su valor por defecto"
        monoColumns={[0, 1]}
        columns={ENGINE_ARGS_COLUMNS}
        rows={ENGINE_ARGS_ROWS}
      />
      <NotePanel icon="ti-info-circle">
        Estos flags viven en el código del motor; su fuente canónica es{" "}
        <Code>factory/standards/build-orchestration.md</Code>. No son algo que normalmente
        configures desde Mission Control.
      </NotePanel>

      <DocH title="Monitorización en Mission Control" />
      <Body margin="0 0 8px">
        Mientras el build corre, Mission Control muestra en tiempo real, sin que intervengas (es de
        solo lectura sobre el build):
      </Body>
      <Ul>
        <li>El estado de cada work order en el tablero Kanban.</li>
        <li>Los agentes activos con su estado en el panel Party.</li>
        <li>Los eventos recientes en la línea de tiempo de observabilidad.</li>
        <li>El freshness badge, que indica si los datos son recientes.</li>
      </Ul>

      <DocH title="Reiniciar tras un bloqueo" />
      <Body margin="0 0 8px">
        Cuando resuelves el bloqueo (corriges el bug escalado o tomas la decisión pendiente),
        actualizas el estado y relanzas. El motor retoma desde el último safe point, con el bloqueo
        resuelto.
      </Body>
      <CmdRow command="/pandacorp:implement" />
    </>
  );
}

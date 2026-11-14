import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";

/** FRD-08 REQ-08-021: the shared explanation of the v2 execution contract. */
export function DesatendidaDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Un CLI, alcance fijo y preguntas al principio" />
      <Body>
        <Code>/pandacorp:implement</Code> utiliza <Code>pandacorp-build.mjs</Code>. Una petición
        conversada fija su alcance en una tarjeta citada; un objetivo FRD o tarjeta selecciona ese
        trabajo y la invocación sin objetivo toma el plan pendiente. El motor no drena otras
        tarjetas. Las preguntas iniciales incluyen defaults explícitos; después continúa el trabajo
        independiente.
      </Body>
      <DocH title="Propiedad y relevo" />
      <Body>
        <Code>AGENTS.md</Code> es la fuente de instrucciones. <Code>CLAUDE.md</Code> contiene
        únicamente el import de una línea <Code>@AGENTS.md</Code>. Claude Code y Codex tienen
        lectura y escritura completas y usan trabajadores de su propio runtime. Un solo escritor por
        checkout y la lease con epoch impiden escrituras de un propietario anterior.
      </Body>
      <Body>
        La lease dura 30 minutos y se renueva mediante comandos del CLI, sin un proceso de latido
        independiente. Una lease vigente no demuestra que el coordinador siga respondiendo.{" "}
        <Code>drive</Code> transfers the same run through a fenced epoch and uses the shared capacity
        allocator for CLI workers. Long-running survival, machine sleep and notifications
        requieren verificación real. Si falta programación, la sesión sigue atendida.
      </Body>
      <DocH title="Concurrencia adaptativa y disco" />
      <Body>
        La escalera 1/2/3/5/8 empieza en 5 sin historial que recomiende menos. La memoria disponible
        y el crecimiento sostenido de swap bajan el paso; la recuperación estable permite subirlo.
        El paso 8 necesita evidencia previa. La presión crítica conserva 1 unidad, nunca 0. El paso
        es un techo, no el número de agentes activos.
      </Body>
      <Body>
        <Code>admission.json</Code> registra paso y motivo; la espera por disco impide nuevas
        asignaciones sin detener las que ya trabajan. Antes de reservar un worktree se comprueban 15
        GiB libres más una reserva de 1,5 GiB. El historial de rendimiento vive fuera de git en{" "}
        <Code>~/.pandacorp/host/perf/journal.jsonl</Code>: tiempos, trabajadores, RAM disponible,
        swap y cambios de paso. Un run sin terminar puede no tener registro; datos ausentes no
        equivalen a cero.
      </Body>
      <DocH title="Revisar y reparar solo lo que falló" />
      <Body>
        An independent reviewer with a fresh context, including on the same model, contrasta el FRD
        completo y vuelve a ejecutar la evidencia. Pasar los criterios numerados no exime de cumplir
        las demás cláusulas normativas. Los tests se trazan al contrato y prueban límites
        adversariales.
      </Body>
      <Body>
        Un gate rojo atribuye el fallo y repara selectivamente las work orders afectadas,
        conservando el trabajo sano. El presupuesto es de tres ejecuciones por unidad: solo build y
        patch lo consumen, no las unidades de tests. Un bloqueo conserva su motivo y permite
        continuar unidades independientes.
      </Body>
      <DocH title="Dudas aparcadas y gates humanos" />
      <Body>
        Reversible technical doubts become recorded engine assumptions with a reason and reversal path.
        They proceed through review and integration without waiting for owner acceptance, even for a lone unit.
        Production, money, deletion and unauthorized external communication retain their human gates.
      </Body>
      <Body>
        Protected actions wait at their gate while independent work continues. Questions are recorded in
        <Code>.pandacorp/inbox/decisions.md</Code>. A tracked inbox has a local mirror at
        <Code>.pandacorp/inbox/decisions.pending.md</Code>. Existing authorization is reused;
        production permission is never granted by the engine.
      </Body>
      <NotePanel icon="lock">
        <B>Los gates humanos siguen vigentes:</B> producción, dinero, borrado de datos y
        comunicaciones externas. El motor nunca se concede permiso de producción.
      </NotePanel>
      <DocH title="Una ruta a main y una reanudación segura" />
      <Body>
        A subscription limit preserves dirty files, worktree, branch, worker session, cell and attempt.
        Independent units continue on the other tool. When all work waits, the run records the earliest
        <Code>resumeAt</Code>. Drive waits until reset plus 60 seconds; the open Claude lead uses
        <Code>ScheduleWakeup</Code>, refreshes usage and resumes through the CLI. One fenced wake
        generation prevents duplicate execution. An elapsed reset without fresh telemetry keeps waiting.
        Every suspension, wait, wake and resume is recorded in <Code>capacity-decisions.jsonl</Code>.
      </Body>
      <Body>
        Todo cambio versionado del run se commitea mediante el CLI en{" "}
        <Code>lane/&lt;run_id&gt;/integration</Code>. Las unidades usan{" "}
        <Code>lane/&lt;run_id&gt;/&lt;unit&gt;</Code>, luego <Code>&lt;unit&gt;-a2</Code> o{" "}
        <Code>&lt;unit&gt;-a3</Code>; las decisiones técnicas reversibles registran un supuesto con su motivo y cómo revertirlo.{" "}
        <Code>merge-queue</Code> es el único camino a main. En un proyecto lanzado la aprobación
        pendiente se muestra como <Code>waiting_gate</Code>; no detiene trabajo independiente.
      </Body>
      <Ul>
        <li>
          Verificado en una rama no significa entregado en main ni seguro para probar. El snapshot
          seguro depende del gate y del aterrizaje, con <Code>last_green_sha</Code> y{" "}
          <Code>safe_to_test</Code>.
        </li>
        <li>
          Reanuda con <Code>/pandacorp:implement --resume &lt;run-id&gt;</Code>. El CLI valida la
          propiedad y reconstruye los worktrees necesarios desde sus ramas.
        </li>
        <li>
          La limpieza retira worktrees elegibles y conserva las referencias de ramas.{" "}
          <Code>waiting_gate</Code> conserva el worktree de integración. No se eliminan directorios
          sucios, bloqueados o usados por procesos; el inventario real confirma qué pudo retirarse.
        </li>
        <li>
          Mission Control solo copia <Code>/pandacorp:worktrees</Code> para revisar la limpieza. Una
          rama conservada no prueba un merge y un directorio ausente no demuestra entrega.
        </li>
      </Ul>
    </>
  );
}

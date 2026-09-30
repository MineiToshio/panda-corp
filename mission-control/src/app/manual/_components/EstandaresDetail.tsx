/**
 * manual/_components/EstandaresDetail.tsx — FRD-08 "Estándares y reglas" detail
 *
 * The standards that shape how the owner works day to day (subagent model choice,
 * README, prompt surface, live-attempt economy, parallel sessions), the decision
 * registry and the lesson-promotion path. Composed by `ConceptEstandares` in
 * manualPages.tsx, the only source the reader renders for this slug. The standards
 * catalog itself is Referencia → Estándares (DR-046): nothing here re-lists it.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { ProseTable } from "@/components/modules/manual-diagrams/ProseTable";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

const DECISION_EXAMPLE_ROWS: readonly (readonly string[])[] = [
  ["DR-001", "Añadir una dependencia: solo librerías aprobadas."],
  ["DR-009", "Idioma de artefactos: committed en inglés, gitignoreado en español."],
  ["DR-032", "Avance entre fases: siempre explícito, nunca automático."],
  ["DR-046", "Catálogos de Referencia: derivados de la fuente canónica, nunca copiados a mano."],
  ["DR-047", "Memoria transversal: cosechar, corroborar antes de confiar, gate humano."],
  ["DR-049", "Estructura de documentos: feature-céntrica por FRD, no por tipo."],
  ["DR-050", "Gate de revisión: por FRD completo, no por work order individual."],
];

/** Sections below the standards overview: recent norms, parallel sessions, registry, learning. */
export function EstandaresDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Normas que notas en el día a día" />
      <Ul>
        <li>
          <B weight={500}>Cobertura del catálogo:</B> además de los estándares clásicos
          (convenciones, estructura, calidad, stack, seguridad, documentación y orquestación del
          build), desde 2026-07 hay estándares de manejo de errores, modelado de datos, auth,
          resiliencia, jobs en background, ciclo de vida de dependencias y feature flags.
        </li>
        <li>
          <B weight={500}>CONV-12 / DR-111:</B> cuando el agente delega una subtarea sin indicar
          modelo, calcula el tier por la complejidad de la subtarea (nunca hereda el de la
          conversación padre) y Fable nunca se elige solo.
        </li>
        <li>
          <B weight={500}>DOC-3 / DR-112:</B> todo proyecto llega con un <Code>README.md</Code> raíz
          poblado (qué hace y cómo levantarlo), nunca el placeholder del scaffold: lo puebla{" "}
          <Code>spec</Code> (qué hace) y <Code>architecture</Code> (cómo levantarlo) y se reverifica
          en el hardening de <Code>implement</Code> y en el checklist de release.
        </li>
        <li>
          <B weight={500}>PROMPT-1 a 8 / DR-114:</B> los prompts de agentes y skills se escriben
          para los modelos que los consumen (metas y restricciones sobre pasos narrados, énfasis
          solo en lo vinculante, una regla un hogar) y toda edición exige una verificación
          independiente de contexto fresco que pruebe que ninguna regla se perdió. Los briefs que el
          motor sintetiza al despachar son autocontenidos, nunca punteros a otro documento.
        </li>
        <li>
          <B weight={500}>QUAL-14 y DEBUG-1 a 4:</B> antes de consumir otro intento atendido por ti,
          se hace red team de la matriz completa de fallos previos y se prueba que el ensayo
          ejercita la frontera real, no un mock; y toda investigación de un incidente sigue el SOP
          de <Code>debugging.md</Code>.
        </li>
        <li>
          <B weight={500}>PORT-1 a 6 / DR-113:</B> la portabilidad entre runtimes (ver{" "}
          <ManualLink group="concepts" slug="multi-runtime">
            Operar desde cualquier agente
          </ManualLink>
          ).
        </li>
      </Ul>
      <Body margin="10px 0 0">
        Los estándares cambian solo por decisión explícita del propietario (
        <Code>/pandacorp:learn</Code>), que exige actualizar la regla inyectable y el registro en el
        mismo cambio (DR-051).
      </Body>

      <DocH title="Trabajar varias cosas a la vez (DR-096, DR-097, DR-099)" />
      <Body>
        Cuando abres <B weight={500}>varias conversaciones en paralelo</B> para avanzar cosas
        distintas al mismo tiempo (a mano, fuera de <Code>/implement</Code>), cada sesión se aísla
        sola en su propio árbol de trabajo de git (un <i>worktree</i>). El motivo: el gate de
        calidad es de programa completo (<Code>tsc</Code>, <Code>knip</Code> y las pruebas visuales
        leen todo el árbol), así que el trabajo a medias de una sesión haría fallar el gate de otra.
        Es transparente: tú hablas normal y dices «ejecuta»; el agente crea el worktree, trabaja y,
        cuando todo está verde, lo <B weight={500}>fusiona solo a la rama principal</B> por una cola
        serializada (un merge a la vez). Solo te enteras si hay un conflicto que no se puede
        resolver automáticamente. <Code>/implement</Code> es distinto: ya evita colisiones por
        construcción y no usa worktrees.
      </Body>
      <Body>
        <B weight={500}>No se pierde nada por olvido.</B> Un worktree que sobrevive es trabajo sin
        mergear, y lo ves de tres formas: el comando <Code>pending-work.sh</Code> (lista lo
        no-mergeado con su antigüedad), el indicador global «⎇ N pendientes» en la barra de Mission
        Control y el detalle por proyecto en su resumen. Aunque cierres la conversación, el trabajo
        vive en su rama de git y se recupera. El detalle está en <Code>build-orchestration.md</Code>{" "}
        («Parallel manual sessions»).
      </Body>
      <Body margin="0 0 8px">
        <B weight={500}>Cuando terminas tú, queda en «Hecho» (DR-097).</B> Si implementas un cambio
        a mano, el estado de su work order pasa a Hecho en cuanto el gate verde (
        <Code>verify.sh</Code>) pasa, sin quedarse varado en «En revisión»: el gate es el
        verificador objetivo y el agente solo registra su veredicto, no se autoevalúa.
      </Body>
      <Body margin="0 0 8px">
        <B weight={500}>Las reglas de paralelo, reforzadas (DR-099).</B> El aislamiento era una
        regla blanda que un agente podía saltarse («el árbol está quieto»). Ahora se refuerza por
        cuatro vías:
      </Body>
      <Ul>
        <li>
          Al editar código de producto directo en el checkout principal, un recordatorio en ese
          momento empuja a aislarse primero.
        </li>
        <li>
          Un merge que no puede aterrizar (conflicto, gate rojo, copia ocupada) dispara una
          notificación de escritorio: nunca es silencioso.
        </li>
        <li>
          Cada conversación se mantiene aislada: un rojo ajeno se maneja en silencio y no se te
          narra lo que hacen otras sesiones (eso lo ves en el indicador de Mission Control). Al
          commitear, si <Code>git status</Code> muestra archivos que no tocaste, el agente hace{" "}
          <Code>git add</Code> solo de los tuyos y commitea, sin preguntarte.
        </li>
        <li>
          El propio gate se calla ante un rojo ajeno: atribuye el rojo comparando los archivos que
          fallan contra los que esta sesión editó (se registran al vuelo) y, si el rojo es solo de
          archivos que no tocaste, deja terminar en silencio y lo registra para verlo en Mission
          Control. Si el rojo toca algo tuyo, o no se puede atribuir, sí te avisa.
        </li>
      </Ul>

      <DocH title="El registro de decisiones" />
      <Body margin="0 0 8px">
        <Code>factory/decisions/registry.yaml</Code> contiene reglas con un{" "}
        <B weight={500}>valor por defecto</B> para decisiones recurrentes. Algunos ejemplos:
      </Body>
      <ProseTable
        label="Ejemplos de reglas del registro de decisiones"
        columns={["Regla", "Qué decide por defecto"]}
        rows={DECISION_EXAMPLE_ROWS}
      />
      <Body margin="10px 0 0">
        Cuando un agente encuentra una situación no cubierta por el registro, te la escala{" "}
        <B weight={500}>una sola vez</B> y codifica tu respuesta como nueva regla. Los agentes
        consultan el registro antes de tomar decisiones recurrentes, y Mission Control muestra los
        estándares y las reglas en Referencia y en la pestaña Configuración del proyecto.
      </Body>

      <DocH title="Promover una lección a estándar o regla" />
      <Body margin="0 0 8px">
        El flujo de autoaprendizaje (DR-047) captura lecciones candidatas en un inbox. Solo tú
        puedes promover una lección a:
      </Body>
      <Ul>
        <li>
          Un estándar nuevo en <Code>factory/standards/</Code>.
        </li>
        <li>
          Una regla nueva en <Code>factory/decisions/registry.yaml</Code>.
        </li>
        <li>Una habilidad nueva en el plugin.</li>
      </Ul>
      <NotePanel icon="ti-school">
        <Code>/pandacorp:learn</Code> facilita la promoción, contigo como gate final.
      </NotePanel>
    </>
  );
}

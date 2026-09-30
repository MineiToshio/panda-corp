/**
 * manual/_components/FeedbackDetail.tsx — FRD-08 "Reportar un bug o responder una decisión"
 *
 * The safe-point semantics of the three feedback channels and how a pending decision
 * is resolved. Composed by `GuideFeedback` in manualPages.tsx, the only source the
 * reader renders for this slug (AC-14-006.1).
 *
 * Traceability: CMP-08-concept-pages → AC-14-006.1.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";

/** Below the three-channel diagram: how the build picks the channels up, and decisions. */
export function FeedbackDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Cómo los recoge el build" />
      <Body>
        Los tres canales son <B weight={500}>archivos</B>: dejas uno en la cola y el agente lo
        recoge en su siguiente <B weight={500}>punto seguro</B> (safe point), sin que tengas que
        pararlo. El motor <B weight={500}>nunca interrumpe</B> a mitad de una work order: lee los
        canales entre work orders, al terminar cada una. El estado (<Code>status.yaml</Code>) lo
        escribe el gate y no el agente: el motor lee los canales y recoge tu feedback entre work
        orders, sin que nadie más toque ese estado.
      </Body>
      <Ul>
        <li>
          <B weight={500}>Algo está roto:</B> <Code>/pandacorp:bug</Code> deja un archivo en la
          cola; la construcción lo recoge en el siguiente safe point y le crea un test de regresión
          antes del fix.
        </li>
        <li>
          <B weight={500}>Un cambio o módulo nuevo:</B> <Code>/pandacorp:iterate</Code>. El PM
          triagea: un ajuste chico se encola; un cambio fuerte te muestra el impacto y pide pausar.
        </li>
        <li>
          <B weight={500}>Responder algo que te preguntó:</B> <Code>/pandacorp:decide</Code>. Te
          muestra la decisión con su recomendación, la registra en <Code>decisions.md</Code> y
          desbloquea el frente.
        </li>
      </Ul>

      <DocH title="Responder decisiones pendientes" />
      <Ul>
        <li>
          Si hay varias pendientes, cada tarjeta del Resumen trae su propio comando{" "}
          <Code>/pandacorp:decide &lt;id&gt;</Code> que apunta a <i>esa</i> decisión; sin el id, te
          las muestra todas una por una.
        </li>
        <li>
          Si una decisión tiene <B weight={500}>7 días o más</B>, el skill la marca y te pregunta si
          sigue vigente <i>antes</i> de pedirte que respondas. Si ya no aplica, la registra como{" "}
          <B weight={500}>OBSOLETA</B> (no RESUELTA): no hace falta inventar una respuesta a algo
          que el código ya superó.
        </li>
        <li>
          Toda resolución, la respondas tú o la resuelva un agente solo durante un build, se marca{" "}
          <B weight={500}>en el bloque original</B> de <Code>decisions.md</Code> y no solo en una
          entrada nueva arriba; si no, la tarjeta se queda «pendiente» para siempre aunque todo esté
          decidido.
        </li>
      </Ul>

      <NotePanel icon="ti-link">
        <B weight={500}>Enlaces:</B> Mission Control te muestra el último commit en verde y seguro
        para probar (el panel de snapshot) y resalta las <B weight={500}>decisiones pendientes</B>{" "}
        del workspace en Portfolio → Resumen.
      </NotePanel>
    </>
  );
}

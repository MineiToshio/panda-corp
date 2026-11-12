import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { Body, Code, Ul } from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

export function FeedbackDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Alcance y preguntas son cosas distintas" />
      <Body>
        El build mantiene el alcance fijado al arrancar. Una nueva tarjeta no se recoge
        automáticamente ni amplía el run. Para guardar un pedido sin construir, la sesión escribe un
        draft y ejecuta <Code>card check</Code>.
      </Body>
      <Body>
        Para probar, usa el snapshot verificado y aterrizado en main. El trabajo verificado en rama
        aún no está entregado. Consulta{" "}
        <ManualLink group="guides" slug="g-probar">
          Probar sin parar al agente
        </ManualLink>
        .
      </Body>
      <DocH title="Responder decisiones pendientes" />
      <Ul>
        <li>
          Cada pregunta conserva su Id explícito. <Code>/pandacorp:decide &lt;id&gt;</Code> aplica
          la respuesta mediante el CLI y puede desbloquear la unidad aparcada y sus dependientes.
        </li>
        <li>
          Las dudas no resueltas aparcan solo el trabajo afectado. Las preguntas viven en{" "}
          <Code>.pandacorp/inbox/decisions.md</Code>; si está versionado, el espejo{" "}
          <Code>.pandacorp/inbox/decisions.pending.md</Code> las hace visibles antes del aterrizaje.
        </li>
        <li>
          Una resolución actualiza la pregunta original. La copia resuelta del espejo suprime una
          copia pendiente antigua hasta aterrizar. Las decisiones obsoletas se distinguen de las
          resueltas.
        </li>
      </Ul>
    </>
  );
}

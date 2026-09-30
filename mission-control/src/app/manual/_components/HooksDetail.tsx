/**
 * manual/_components/HooksDetail.tsx — FRD-08 "Hooks, gates y seguridad" detail
 *
 * The automatic quality gate, the per-FRD review gate, the factory's own gates and
 * the agentic-security posture. Composed by `ConceptHooks` in manualPages.tsx, the
 * only source the reader renders for this slug. The human gates have their own page
 * (`los-gates-humanos`); this one links to it.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

/** Sections below the hooks diagram: quality gates, review gate, factory gates, security. */
export function HooksDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Gates humanos" />
      <Body>
        Las acciones irreversibles o costosas (elegir qué idea construir, aprobar el diseño,
        autorizar el release, gastar dinero, conectar servicios externos, borrar datos, comunicarte
        hacia afuera) solo las autoriza el propietario. Están codificadas como reglas{" "}
        <Code>deny</Code> en <Code>.claude/settings.json</Code> y como hooks deterministas: el
        contexto de una conversación puede compactarse y perderse, un hook no. La lista completa
        está en{" "}
        <ManualLink group="concepts" slug="los-gates-humanos">
          Los gates humanos
        </ManualLink>
        .
      </Body>

      <DocH title="Gates de calidad (automáticos)" />
      <Body margin="0 0 8px">
        El script <Code>.pandacorp/verify.sh</Code> es el gate de calidad de un proyecto y falla
        cerrado: un arnés que falta es un rojo, nunca un salto. Corre, entre otros:
      </Body>
      <Ul>
        <li>
          <Code>vitest</Code>: todos los tests deben pasar.
        </li>
        <li>
          <Code>tsc --noEmit</Code>: sin errores de tipos.
        </li>
        <li>
          <Code>biome check</Code>: sin errores de lint ni de formato.
        </li>
        <li>
          <Code>knip</Code> y <Code>madge</Code>: sin código muerto ni dependencias circulares.
        </li>
        <li>
          Las guardas de estructura, de capa de datos y de contrato de errores, el doc-lint y la
          búsqueda de <Code>[NEEDS CLARIFICATION]</Code> residuales.
        </li>
        <li>Los gates de navegador (Playwright): smoke, fidelidad visual y responsive.</li>
      </Ul>
      <Body margin="10px 0 0">
        Si falla, el motor de <Code>implement</Code> no avanza sobre código roto: repara el fallo
        puntual (máximo 3 intentos por subtarea) y solo si no converge escala al propietario. La
        escalera de reparación completa está en{" "}
        <ManualLink group="concepts" slug="construccion-desatendida">
          Construcción desatendida
        </ManualLink>
        .
      </Body>

      <DocH title="Gate de revisión por FRD (DR-050)" />
      <Body margin="0 0 8px">
        Cuando todas las work orders de un FRD están en <Code>IN_REVIEW</Code>, el agente{" "}
        <B weight={500}>reviewer</B> (de un modelo distinto al del implementer) ejecuta el gate del
        FRD:
      </Body>
      <Ul>
        <li>
          Vuelve a correr <Code>verify.sh</Code> en un entorno limpio.
        </li>
        <li>Lee todos los criterios de aceptación EARS del FRD.</li>
        <li>Escribe tests adversariales que el implementer no vio.</li>
        <li>Ejecuta mutation testing para confirmar que los tests no son decorativos.</li>
        <li>Solo si todo pasa marca las work orders como VERIFIED y el FRD avanza.</li>
      </Ul>
      <NotePanel icon="ti-scale" iconColor="var(--color-accent)">
        <B weight={500}>La invariante:</B> el implementer nunca verifica su propio trabajo. No hay
        «bypass»: un agente que se saltara este gate violaría la constitución.
      </NotePanel>

      <DocH title="Gates de la propia fábrica" />
      <Ul>
        <li>
          <B weight={500}>Deriva de artefactos generados</B> (<Code>check-derived-drift.sh</Code>,
          hook de Stop): los espejos Codex (<Code>.codex/agents/*.toml</Code>), el manifest espejo
          del plugin y el symlink <Code>.agents/skills</Code> se verifican contra sus fuentes únicas
          en cada sesión. Si detecta deriva, la sesión no puede cerrar hasta regenerar (DR-113).
        </li>
        <li>
          <B weight={500}>Aviso de aislamiento con alcance real</B> (BL-0033): el recordatorio de
          worktree (DR-096) ya no salta al editar prosa de la fábrica (estándares, docs, texto de
          skills, superficies sin gate de programa completo); sigue saltando para lo que se ejecuta
          o se despliega a proyectos (<Code>plugin/scripts</Code>, <Code>plugin/hooks</Code>,{" "}
          <Code>plugin/templates</Code>, <Code>mission-control/</Code>). En la fábrica se aterriza
          directo a <Code>main</Code>: la merge queue existe solo en los proyectos.
        </li>
      </Ul>

      <DocH title="Seguridad de las operaciones agénticas" />
      <Body margin="0 0 8px">
        La fábrica sigue el OWASP Top 10 para aplicaciones agénticas (ASI01 a ASI10). Cuatro
        ejemplos concretos:
      </Body>
      <Ul>
        <li>
          <B weight={500}>Tool Misuse:</B> los agentes solo usan las herramientas que necesitan; las
          operaciones destructivas (force-push, borrado de datos, deploy a producción) requieren
          gate humano explícito.
        </li>
        <li>
          <B weight={500}>Identity &amp; Privilege Abuse:</B> cada agente opera con el mínimo
          privilegio que su rol necesita.
        </li>
        <li>
          <B weight={500}>Memory Poisoning:</B> <Code>.pandacorp/comms/progress.md</Code> y la
          memoria de la fábrica son fuentes de verdad que solo se actualizan mediante commits
          verificados; las lecciones candidatas no se promueven sin gate humano.
        </li>
        <li>
          <B weight={500}>Cascading Failures:</B> un fallo se contiene en su work order: el motor
          reintenta de forma acotada y sigue con lo independiente, sin propagar el error al resto
          del build.
        </li>
      </Ul>

      <NotePanel icon="ti-key" iconColor="var(--color-warn)">
        <B weight={600}>Secretos.</B> Nunca en el código ni en el contexto de los agentes: se
        inyectan por variables de entorno, el <Code>.gitignore</Code> excluye <Code>.env*</Code> y
        SOPS + age es el gestor de secretos recomendado (DR-037).
      </NotePanel>
    </>
  );
}

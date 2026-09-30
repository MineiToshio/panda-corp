/**
 * manual/_components/PipelineDetail.tsx — FRD-08 "El pipeline" detail
 *
 * What each stage actually does beyond the stage cards of the diagram: the design
 * engine routing (DR-109), the work-order sizing and the three plan gates
 * (DR-100/102/116), the build's repair and convergence rules, the three build modes,
 * release, advancing, iterating and the reverse flow. Composed by `ConceptPipeline`
 * in manualPages.tsx, the only source the reader renders for this slug.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { ProseTable } from "@/components/modules/manual-diagrams/ProseTable";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

const BUILD_MODE_ROWS: readonly (readonly string[])[] = [
  ["Completo", "/pandacorp:implement", "Todos los FRDs pendientes, en orden de dependencias."],
  [
    "Parcial por FRD",
    "/pandacorp:implement frd-05-settings",
    "Solo el FRD indicado (o varios separados por espacio). Un gate bloquea si sus dependencias no están VERIFIED.",
  ],
  [
    "Por change",
    "/pandacorp:implement change:mc-fix-pagination",
    "Procesa la change, crea o actualiza los FRDs y las work orders, y construye solo los afectados.",
  ],
];

/** The per-stage detail, from Design to the reverse flow (code to docs). */
export function PipelineDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Antes del pipeline: ideas y memo-pitch" />
      <Body>
        Antes de la fase product, una idea nace en el tablero, ya sea que la encuentre{" "}
        <Code>/pandacorp:discover</Code> o que la traigas tú a <Code>/pandacorp:new-idea</Code>.
        Cada idea que sobrevive se escribe como un <B weight={500}>memo-pitch</B> ordenado de
        caliente a frío: arriba el sueño (la apuesta, el problema contado, por qué tú, la visión) y
        abajo el criterio para decidir (mercado, distribución, gaps y riesgos, red team, el ask). En
        el tablero, al abrir la card, la pestaña <B weight={500}>Propuesta</B> (la primera, por
        defecto) te muestra ese pitch con el diseño de Pandacorp.
      </Body>

      <DocH title="Product" />
      <Body>
        Se documenta la visión del producto en el <B weight={500}>PRD</B> (objetivos, métricas de
        éxito, hipótesis de valor y el mapa de funcionalidades) y se generan los{" "}
        <B weight={500}>FRDs</B> con criterios de aceptación en formato EARS para cada
        funcionalidad. Habilidades: <Code>/pandacorp:spec</Code>, <Code>/pandacorp:explore</Code> y{" "}
        <Code>/pandacorp:new-idea</Code>.
      </Body>

      <DocH title="Design" />
      <Body>
        Se crean mockups navegables con identidad visual propia del dominio. El sistema de diseño
        produce los tokens (colores, espaciado, tipografía, radio) que son la única fuente de
        valores visuales en el código: nunca valores escritos a mano. Habilidad:{" "}
        <Code>/pandacorp:design</Code>.
      </Body>
      <Body>
        El motor de generación se elige por situación, con una tabla de ruteo (DR-109): en un
        proyecto nuevo con acceso al canvas el motor por defecto es{" "}
        <B weight={500}>Claude Design</B> (claude.ai/design); sin acceso, direcciones HTML hechas a
        mano; con un visual ya aprobado se extrae fielmente (ADOPT-VISUAL); y en brownfield con UI
        construida se itera en el repo.
      </Body>
      <Body margin="0 0 8px">
        Con Claude Design el loop lo conduce el agente, con estado en disco:
      </Body>
      <Ul>
        <li>
          Un <B weight={500}>tracker</B> enumera desde los FRDs todas las pantallas a generar:
          saltarse una página es imposible, el gate de avance lo verifica.
        </li>
        <li>
          Los prompts viajan por el mejor transporte disponible (el navegador vía claude-in-chrome,
          o el portapapeles: tu único trabajo por ronda es un Cmd+V).
        </li>
        <li>
          El agente <B weight={500}>detecta solo</B> cuándo terminó el canvas (polling) y revisa
          cada pantalla contra una rúbrica antes de mostrártela; cada ronda queda registrada en el
          journal.
        </li>
        <li>
          Al cierre, un barrido reconcilia los componentes usados en las pantallas contra la galería
          del sistema.
        </li>
      </Ul>
      <NotePanel icon="ti-hand-click" iconColor="var(--color-accent)">
        Tú solo tomas decisiones (aprobar, corregir o diferir); nunca haces de mensajero.
      </NotePanel>

      <DocH title="Architecture" />
      <Body>
        Se documenta la arquitectura de la plataforma (<Code>docs/product/architecture.md</Code>) y
        el blueprint de cada FRD (<Code>docs/frds/frd-NN-&lt;slug&gt;/blueprint.md</Code>). Se
        generan las <B weight={500}>work orders</B>, que dividen la construcción en rebanadas
        cohesivas y gruesas, con una banda calibrada con datos de builds reales (DR-100): objetivo
        de unos 25 a 50 minutos de build y 1,5 a 4k líneas por work order, con un{" "}
        <B weight={500}>techo</B> de unas 4k líneas (por encima, los rechazos del gate escalan de
        forma superlineal) y un <B weight={500}>piso</B> de unos 20 minutos (el gate por FRD cuesta
        unos 9 minutos fijos, así que una feature diminuta pagaría más gate que build: se fusiona
        con la feature que extiende).
      </Body>
      <Body>
        El Build Plan del blueprint lleva una <B weight={500}>tabla DAG obligatoria</B> (WO,
        dependencias, artifacts, foundation, paralelo-con) que el motor lee directamente, y el
        readiness gate verifica además que los <Code>artifacts</Code> declarados sean{" "}
        <B weight={500}>completos</B>, no solo disjuntos: con las oleadas globales, una omisión
        puede chocar entre FRDs.
      </Body>
      <Body margin="0 0 8px">
        Antes de que las work orders pasen a <Code>ACTIVE</Code>, el plan cruza{" "}
        <B weight={500}>tres gates independientes que corren en paralelo</B>, cada uno por un agente
        fresco en su propio contexto y de tier JUDGE (opus, DR-111):
      </Body>
      <Ul>
        <li>
          El <B weight={500}>readiness gate</B> (DR-100): cada requisito mapea a un componente, cada
          criterio de aceptación lo cubre exactamente una work order, el modelo de datos no tiene
          huecos (<Code>TBD</Code>), el grafo de dependencias es acíclico, la foundation está
          completa y no queda ninguna pregunta abierta (<Code>[NEEDS CLARIFICATION]</Code> bloquea).
        </li>
        <li>
          El <B weight={500}>grounding gate</B> (DR-102): valida cada afirmación concreta (rutas,
          APIs del framework, versiones) contra el scaffold realmente instalado.
        </li>
        <li>
          El <B weight={500}>contradiction gate</B> (DR-116): asegura que el set no se contradice a
          sí mismo ni a los FRDs que implementa.
        </li>
      </Ul>
      <Body margin="10px 0 0">
        El paso a <Code>ACTIVE</Code> espera a que los tres salgan en verde; con cualquier bloqueo,
        los documentos se quedan en <Code>DRAFT</Code>. Un blueprint con agujeros produce work
        orders ambiguas, así que la cohesión se <B weight={500}>verifica</B>, no se confía.
      </Body>
      <Body>
        Al cerrar la fase, el skill emite <Code>.pandacorp/comms/arquitectura-resumen.md</Code> (en
        español, para ti) que Mission Control muestra en la pestaña <B weight={500}>Arquitectura</B>{" "}
        de la card: el stack, el modelo de datos (con la rama «Sin BD: contenido como código»), la
        comunicación y los servicios, los ADRs y las variables de entorno (leídos en vivo de{" "}
        <Code>docs/adr/</Code> y <Code>.env.example</Code>) y el plan de implementación como grafo
        DAG de las work orders. Cada FRD abre un modal con su blueprint y sus work orders y, si
        tiene más de una, su propio sub-DAG de dependencias y paralelismo.
      </Body>
      <NotePanel icon="ti-writing-sign">
        El skill cambió de nombre de <Code>/pandacorp:blueprint</Code> a{" "}
        <Code>/pandacorp:architecture</Code> (la fase produce la arquitectura completa, no solo un
        blueprint). El artefacto <Code>blueprint.md</Code> por FRD conserva su nombre: sigue siendo
        la capa de diseño de implementación de cada feature.
      </NotePanel>

      <DocH title="Build (implement)" />
      <Body>
        El motor de <Code>implement</Code> orquesta subagentes especializados que construyen las
        work orders con TDD (RED, GREEN, refactor), y el <B weight={500}>reviewer</B> valida cada
        FRD antes de marcarlo VERIFIED. Si una work order falla la revisión, el motor{" "}
        <B weight={500}>repara el fallo puntual en sitio antes de reconstruirla</B> y sube el modelo
        a Opus cuando la work order es difícil o ya falló (DR-073). El mecanismo completo está en{" "}
        <ManualLink group="workflows" slug="wf-pandacorp-build">
          pandacorp-build
        </ManualLink>
        .
      </Body>
      <Body margin="0 0 8px">Reglas del ciclo de rechazo y del gate:</Body>
      <Ul>
        <li>
          <B weight={500}>Presupuesto de convergencia (DR-107):</B> el parche puede corregir los
          fallos que sus propios edits introdujeron (hasta 2 ciclos internos); si el bloqueador es
          un test adversarial defectuoso del reviewer (imposible de satisfacer por una
          implementación correcta), un agente independiente repara el <i>test</i> y nunca se
          descarta un build correcto (BL-0001); y si aun así hay que revertir, los tests con
          evidencia se preservan y la work order se reintenta una vez en la misma corrida desde una
          base limpia antes de diferirse.
        </li>
        <li>
          <B weight={500}>Verificación acotada por FRD (DR-106):</B> vitest solo de lo afectado y,
          del navegador, solo smoke y shell; la suite e2e completa (visual y responsive) corre una
          sola vez al cierre.
        </li>
        <li>
          <B weight={500}>Context pack (DR-108):</B> cada builder recibe la ruta de su work order y
          los criterios EARS que le tocan, extraídos una sola vez por el planner, para construir
          bien al primer intento en vez de releer todos los documentos.
        </li>
        <li>
          <B weight={500}>Modelos por tarea:</B> los pasos mecánicos (commits, stamps de estado,
          sync, archivo, avisos) corren en el modelo económico (haiku); el trabajo real mantiene
          sonnet como piso con escalada a opus (DR-073).
        </li>
        <li>
          El motor además emite los eventos <Code>achievement</Code> y <Code>gate</Code> que
          alimentan la Bóveda y el tribunal del Party (BL-0020).
        </li>
      </Ul>
      <Body margin="14px 0 8px">La habilidad acepta tres modos de construcción:</Body>
      <ProseTable
        label="Modos de construcción de implement"
        columns={["Modo", "Invocación", "Qué construye"]}
        rows={BUILD_MODE_ROWS}
        monoColumns={[1]}
      />
      <Body margin="10px 0 0">
        Los identificadores se normalizan solos: <Code>frd-05-settings</Code>,{" "}
        <Code>docs/frds/frd-05-settings</Code> y <Code>docs/frds/frd-05-settings/frd.md</Code> son
        equivalentes, y lo mismo para el nombre de una change (con o sin <Code>.md</Code>, con o sin
        ruta). Si hay dependencias sin VERIFIED, el motor se detiene antes de escribir código y
        lista exactamente qué implementar primero. El flujo de cada modo está en la guía{" "}
        <ManualLink group="guides" slug="g-implement-parcial">
          Build parcial: por FRD o por change
        </ManualLink>
        .
      </Body>

      <DocH title="Release" />
      <Body>
        <Code>release</Code> es la fase <B weight={500}>lanzada y terminal</B> (DR-085): la
        auditoría de calidad, seguridad y telemetría ya se hizo como último paso de la construcción,
        así que aquí solo queda desplegar, con un plan de lanzamiento informado por el análisis de
        demanda y un gate humano obligatorio antes de cualquier despliegue a producción. Desde{" "}
        <Code>release</Code> se opera (se miden métricas reales y se decide) y se itera: no existe
        una fase «operation» aparte. <Code>/pandacorp:review-launch</Code> corre sobre un proyecto
        ya en <Code>release</Code> y lee las métricas reales contra la hipótesis de valor del PRD
        para recomendar kill, hold o double-down.
      </Body>

      <DocH title="Avance entre fases" />
      <Body>
        El avance es siempre <B weight={500}>explícito</B>: cada skill termina con{" "}
        <Code>advance_pending: true</Code> y espera tu «ok». Volver a ejecutar la misma skill refina
        el resultado, no lo regenera ni avanza solo (DR-032). El archivo{" "}
        <Code>.pandacorp/status.yaml</Code> de cada proyecto registra la fase actual, la versión y
        el SHA del último commit verde, y Mission Control lo lee para mostrar el estado en el
        portfolio.
      </Body>

      <DocH title="Iterar sin retroceder" />
      <Body>
        Puedes añadir funcionalidades o cambiar comportamientos en cualquier momento del pipeline,
        sin volver a la fase product: se piden por <Code>/pandacorp:change</Code>, que los clasifica
        y los deja en la cola, y el motor crea las work orders nuevas y las integra en el build.
      </Body>

      <DocH title="El flujo inverso: del código a los documentos" />
      <Body>
        A veces editas el código directamente (para ir rápido o ver el cambio en vivo) y entonces el
        código se adelanta a los documentos. <Code>/pandacorp:sync</Code> es el{" "}
        <B weight={500}>flujo inverso</B> (código a documentos): clasifica los cambios, te muestra
        un plan y, con tu visto bueno, propaga la realidad a los documentos dueños (FRD, work
        orders, blueprint, FDD) y a <Code>docs/decision-log.md</Code>. Como el código pasa a ser el
        oráculo, <B weight={500}>documenta pero no verifica</B>: tú aportas la intención en un gate,
        y un bug o una feature documentada pero no construida no se escribe en la especificación: se
        deriva a <Code>/pandacorp:change</Code>. El detalle está en la guía «Documentar cambios
        hechos a mano».
      </Body>
    </>
  );
}

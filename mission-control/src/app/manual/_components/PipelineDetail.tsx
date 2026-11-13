/**
 * manual/_components/PipelineDetail.tsx : FRD-08 "El pipeline" detail
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

import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

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
        El motor de generación se elige por situación (DR-109): en un proyecto nuevo el motor por
        defecto son direcciones HTML hechas a mano en el repo; con un visual aprobado se extrae
        fielmente (ADOPT-VISUAL); en brownfield se itera en el repo. El repo es la fuente de verdad
        y el agente verifica allí cada dirección antes de mostrártela.
      </Body>
      <Body margin="0 0 8px">
        La revisión se hace con <B weight={500}>Artifacts privados</B>, y el agente conduce el loop
        con estado en disco:
      </Body>
      <Ul>
        <li>Un tracker enumera desde los FRDs todas las pantallas y evita saltarse una página.</li>
        <li>
          Cada prototipo se publica como Artifact privado con un enlace estable para toda la fase.
          Puedes abrirlo y comentarlo desde cualquier dispositivo.
        </li>
        <li>
          Antes de cada ronda, el agente lee los comentarios, refina el archivo local y lo republica
          en el mismo enlace. Cada ronda queda registrada en el journal.
        </li>
        <li>Si la sesión no puede publicar Artifacts, se usan archivos locales o capturas.</li>
        <li>Al cierre, el agente reconcilia los componentes con la galería del sistema.</li>
      </Ul>
      <NotePanel icon="users" iconColor="var(--violet)">
        Tú solo tomas decisiones (aprobar, corregir o diferir); nunca haces de mensajero.
      </NotePanel>
      <Body margin="0 0 8px">
        Cada ronda empieza con un <B weight={500}>preflight del prototipo</B> (tokens en el CSS,
        nada de demo con <Code>?demo=off</Code>, texto de 12 px o más, hover solo donde hay hover):
        lo que encuentra se arregla en esa ronda. Al aprobar, la <B weight={500}>congelación</B> es
        un plan acotado (DR-129):
      </Body>
      <Ul>
        <li>
          Etapas en paralelo con su tracker: la herramienta del plugin extrae tokens y CSS, mide los
          componentes y trocea los mocks por FRD mientras los agentes reconcilian FRDs y textos. Si
          se corta, retoma donde quedó.
        </li>
        <li>
          <B weight={500}>Una sola auditoría</B> independiente: se arreglan solo los bloqueantes y
          el resto va a la lista de QA visual del final de la construcción. No hay segunda
          auditoría.
        </li>
        <li>
          Objetivo de 60 a 100 minutos, <B weight={500}>tope de 2 horas</B>: al llegar al tope se
          entrega con los bloqueantes arreglados. Recibes un estado corto por hito.
        </li>
        <li>
          La meta de fidelidad es por capas y medida (tipografía y colores exactos, tamaños exactos,
          espaciados a ±1 px, píxeles por franja): en la construcción, una diferencia medida bloquea
          por defecto.
        </li>
        <li>
          <B weight={500}>El FDD solo especifica lo que el prototipo dibuja</B> (DR-130): cada
          pantalla y estado del FDD cita su captura, y cada control o texto que nombra aparece en
          ella. Lo que falta se dibuja como estado capturado o sale del FRD contigo; el chequeo{" "}
          <Code>check-fdd-coverage.mjs</Code> lo exige antes de READY.
        </li>
      </Ul>

      <DocH title="Architecture" />
      <Body>
        La fase empieza con dos cosas antes de escribir nada (DR-131). Primero un{" "}
        <B weight={500}>preflight de insumos</B>: si el diseño tiene estados sin dibujar, para, te
        dice cuántos y cuánto tardaría, y lo manda a una mini ronda de diseño. Después la{" "}
        <B weight={500}>ronda de decisiones</B>: en una sola tanda te pregunta cada elección técnica
        que te afecta (stack, hosting y costo al mes, guardar o enlazar las imágenes de terceros,
        cómo entra y se cura la información y si hace falta una web de administración, fuentes
        externas y su riesgo legal, lo que ya resolviste en otro proyecto), cada una con contexto,
        alternativas, la recomendada y por qué, y hechos verificados en vivo. Siempre resuelve por
        separado <B weight={500}>PostHog, Sentry, internacionalización y SEO con metadatos</B>:
        implementar ahora, aplazar o excluir; en idiomas, uno al lanzamiento, varios ahora o ampliar
        después, siempre con textos centralizados traducibles. El silencio no aprueba estas cuatro
        decisiones; un «como recomiendes» explícito sí. Al aplazar o excluir no quedan SDKs,
        esqueletos, secretos ni pruebas obligatorias de esa capacidad. Cada respuesta queda como ADR
        y se reutiliza en siguientes rondas, así no hay que deshacer documentos después. Solo te
        escribe en cuatro hitos: decisiones, plan listo, gates pasados y merge. En el MVP no se
        construyen respaldos propios de base de datos hacia R2 u otro almacenamiento externo: se
        verifica la recuperación nativa del proveedor y su ventana real. Guardar exportaciones del
        producto es una decisión independiente. Los respaldos externos se evalúan después de validar
        el producto.
      </Body>
      <Body>
        Está hecha para ir rápido: te anuncia al inicio el presupuesto (unas 5 horas y unos 6 M de
        tokens para 6 a 8 FRDs) y, si una etapa pasa del doble, para y te ofrece la opción más
        barata. Todo lo independiente corre en paralelo por grupos, cada agente con el tier y el
        esfuerzo que su tarea merece (MECH, STANDARD o JUDGE, sin nombres de modelo: se resuelven
        desde <Code>model-tiers.json</Code>, igual en Claude que en Codex), y cada agente lee un{" "}
        <B weight={500}>paquete de contexto</B> (<Code>build-packs.mjs</Code>) más los FRDs que le
        tocan, en vez de releer todos los documentos. Un cambio tardío se aplica como delta, nunca
        regenerando.
      </Body>
      <Body>
        Se documenta la arquitectura de la plataforma (<Code>docs/product/architecture.md</Code>) y
        el blueprint de cada FRD (<Code>docs/frds/frd-NN-&lt;slug&gt;/blueprint.md</Code>). Se
        generan las <B weight={500}>work orders</B>, que dividen la construcción en rebanadas
        cohesivas y gruesas, con una banda calibrada con datos de builds reales (DR-100): objetivo
        de unos 25 a 50 minutos de build y 1,5 a 4k líneas por work order, con un{" "}
        <B weight={500}>techo</B> de unas 4k líneas (por encima, los rechazos del gate escalan de
        forma superlineal) y un <B weight={500}>piso</B> de unos 20 minutos (el gate por FRD cuesta
        unos 9 minutos fijos, así que una feature diminuta pagaría más gate que build: se fusiona
        con la feature que extiende). El gate de preparación vuelve a pasar el mismo chequeo sobre
        blueprints y work orders: no se planifica interfaz que el prototipo congelado no dibuja; si
        falta, vuelve a diseño.
      </Body>
      <Body>
        El Build Plan del blueprint lleva una <B weight={500}>tabla DAG obligatoria</B> (WO,
        dependencias, artifacts, foundation, paralelo-con) que el motor lee directamente, y el
        readiness gate verifica además que los <Code>artifacts</Code> declarados sean{" "}
        <B weight={500}>completos</B>, no solo disjuntos: con trabajo concurrente, una omisión puede
        chocar entre FRDs.
      </Body>
      <Body margin="0 0 8px">
        Antes de que las work orders pasen a <Code>ACTIVE</Code>, el plan cruza{" "}
        <B weight={500}>tres gates independientes que corren en paralelo</B>, cada uno por un agente
        fresco en su propio contexto: grounding y contradicciones en tier JUDGE; readiness son los
        scripts deterministas del lead más un chequeo semántico en tier STANDARD:
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
        los documentos se quedan en <Code>DRAFT</Code>. Antes de lanzarlos, el lead corre los
        chequeos mecánicos (<Code>waves.mjs</Code>, <Code>ac-matrix.mjs</Code>,{" "}
        <Code>plan-consistency.mjs</Code>); los bloqueos se arreglan en{" "}
        <B weight={500}>una sola pasada</B>, se re-verifican de forma determinista y{" "}
        <Code>flip-active.mjs</Code> pone los sellos. Un blueprint con agujeros produce work orders
        ambiguas, así que la cohesión se <B weight={500}>verifica</B>, no se confía.
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
      <NotePanel icon="file">
        El skill cambió de nombre de <Code>/pandacorp:blueprint</Code> a{" "}
        <Code>/pandacorp:architecture</Code> (la fase produce la arquitectura completa, no solo un
        blueprint). El artefacto <Code>blueprint.md</Code> por FRD conserva su nombre: sigue siendo
        la capa de diseño de implementación de cada feature.
      </NotePanel>

      <DocH title="Build (implement)" />
      <Body>
        <Code>/pandacorp:implement</Code> es la entrada única. El CLI común fija el alcance, admite
        unidades según recursos y coordina trabajadores locales. Un revisor de la otra compañía
        contrasta el FRD completo con pruebas trazables y evidencia adversarial.
      </Body>
      <Body>
        Un gate rojo repara solo las work orders atribuidas al fallo. Solo build y patch consumen
        las tres ejecuciones por unidad. Las dudas no resueltas aparcan sus dependientes mientras
        continúa el resto. Todo cambio versionado va por integración y <Code>merge-queue</Code>; una
        rama verificada no significa entrega en main.
      </Body>
      <Body>
        En Comandos y Campaña eliges Construir, Reanudar u Objetivo: FRD o tarjeta.{" "}
        <Code>/pandacorp:implement --resume &lt;run-id&gt;</Code> retoma con las mismas garantías de
        propiedad. El detalle está en{" "}
        <ManualLink group="concepts" slug="construccion-desatendida">
          el motor v2
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
        El avance de las fases manuales es siempre <B weight={500}>explícito</B>: cada skill termina
        con <Code>advance_pending: true</Code> y espera tu «ok». Volver a ejecutar la misma skill
        refina el resultado, no lo regenera ni avanza solo (DR-032). El archivo{" "}
        <Code>.pandacorp/status.yaml</Code> de cada proyecto registra la fase actual, la versión y
        el SHA del último commit verde, y Mission Control lo lee para mostrar el estado en el
        portfolio.
      </Body>

      <DocH title="Iterar sin retroceder" />
      <Body>
        Puedes añadir funcionalidades o cambiar comportamientos en cualquier momento del pipeline,
        sin volver a la fase product: se piden por <Code>/pandacorp:implement</Code> con un alcance
        fijo. Para anotarlos sin construir se escribe un draft y la sesión ejecuta{" "}
        <Code>card check</Code>; no se incorporan a otro run.
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
        deriva a <Code>/pandacorp:implement</Code>. El detalle está en la guía «Documentar cambios
        hechos a mano».
      </Body>
    </>
  );
}

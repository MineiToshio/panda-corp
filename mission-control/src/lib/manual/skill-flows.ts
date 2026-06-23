/**
 * Curated, "for-dummies" flow specs per skill — the SOURCE for the Manual's interactive flow graph.
 *
 * The Reference catalog (skills/agents/rules/standards) is DERIVED live from the factory (DR-046);
 * THIS layer is the hand-authored, accurate, plain-language explanation + step-by-step flow that the
 * raw frontmatter can't express. Each step's `calls` are clickable: a `skill` node navigates to that
 * skill's own flow (a navigable graph), an `agent` node to that agent's card.
 *
 * Accuracy contract: every flow reflects the REAL `plugin/skills/<slug>/SKILL.md` + the factory's
 * decision rules — nothing invented. When a skill changes, update its flow here (decision-log
 * discipline). Not every skill needs a flow; `getSkillFlow` returns undefined when none is authored.
 */

/** A clickable reference from a flow step to another skill or agent. */
export interface FlowCall {
  /** Skill slug (e.g. "spec") or agent id (e.g. "reviewer"). */
  ref: string;
  as: "skill" | "agent";
  /** What it does at this step (optional, for the tooltip/sub-line). */
  note?: string;
}

/**
 * Step kind drives the node's color/icon:
 * - action: a normal step      - gate: a decision / human gate
 * - safe: a safe point/commit  - io: owner input/output
 * - loop: a repeating phase
 */
export type FlowStepKind = "action" | "gate" | "safe" | "io" | "loop";

export interface FlowStep {
  title: string;
  kind: FlowStepKind;
  /** One plain-language line — what happens here, for dummies. */
  detail?: string;
  /** When true, the step's `calls` run in parallel (rendered side-by-side with an "en paralelo" tag). */
  parallel?: boolean;
  /** Optional condition / caveat note. */
  note?: string;
  /** Skills/agents this step invokes — clickable. */
  calls?: FlowCall[];
}

export interface SkillFlow {
  slug: string;
  /** 2–4 sentences, plain language: what it does, why it matters, when you use it. */
  explainer: string;
  runsIn: "factory" | "project";
  steps: FlowStep[];
  /** What repeats across the flow (optional). */
  loop?: string;
}

// ---------------------------------------------------------------------------
// The curated flows. Authored from the real SKILL.md bodies + registry.yaml.
// ---------------------------------------------------------------------------

const FLOWS: SkillFlow[] = [
  {
    slug: "onboarding",
    explainer:
      "Es el primer paso al clonar la fábrica: convierte una fábrica genérica en TU fábrica. Te entrevista a fondo (nombre, metas, intereses, activos, apetito de monetización, cómo trabajas) y guarda tu perfil en factory/profile.md (personal, no se sube). Ese perfil alimenta a /discover y /recommend para que te propongan ideas alineadas contigo. Es idempotente: re-correrlo actualiza tu perfil sin empezar de cero.",
    runsIn: "factory",
    steps: [
      {
        title: "Saludo y contexto",
        kind: "action",
        detail:
          "Explica en 2-3 líneas qué es la fábrica y por qué te entrevista; si ya hay un perfil, ofrece actualizarlo en vez de empezar de cero.",
      },
      {
        title: "Bootstrap desde tu historial",
        kind: "io",
        detail:
          "Te pregunta SÍ/NO si quiere sacar contexto de tus conversaciones previas de Claude Code para empezar la entrevista 'caliente'; si dices que no, salta a la entrevista.",
        note: "Pregunta primero (DR-053); si es 'no', se omite",
        calls: [
          {
            ref: "researcher",
            as: "agent",
            note: "subagentes extraen señal personal (intereses, activos, cómo trabajas) de tus turnos",
          },
        ],
      },
      {
        title: "Entrevista",
        kind: "io",
        detail:
          "Conversación en tandas cortas (no un formulario de golpe) sobre quién eres, intereses, gustos, metas, activos/palancas, apetito de monetización, tipos de proyecto, GitHub, ruta de proyectos, idioma, país y cómo trabajas.",
      },
      {
        title: "Escribir el perfil",
        kind: "safe",
        detail:
          "Crea factory/profile.md (gitignored) con lo hablado; nunca inventa: lo que no dijiste queda vacío. También crea el portfolio si falta.",
      },
      {
        title: "Cerrar con próximos pasos",
        kind: "action",
        detail: "Te sugiere, personalizado a tu perfil, cómo seguir.",
        calls: [
          { ref: "discover", as: "skill", note: "que la fábrica busque ideas alineadas contigo" },
          { ref: "new-idea", as: "skill", note: "capturar una idea propia" },
          { ref: "recommend", as: "skill", note: "pedir un ranking" },
        ],
      },
    ],
  },
  {
    slug: "explore",
    explainer:
      "Es el modo conversacional de descubrimiento: piensa contigo para clarificar una idea que aún no tienes clara, haciendo de sparring (te rebate lo flojo, valida lo bueno, propone ángulos) con investigación ligera al vuelo. NO escribe nada en el tablero: cuando dices que estás listo, le pasa el testigo a /new-idea para cristalizar la tarjeta.",
    runsIn: "factory",
    steps: [
      {
        title: "Ubicar el punto de partida",
        kind: "action",
        detail:
          "Idea nueva y difusa (de cero), retomar una exploración (lee el borrador en _drafts/) o desarrollar una tarjeta existente aún en «Descubierta».",
      },
      {
        title: "Conversar como sparring",
        kind: "loop",
        detail:
          "Piensa contigo: rebate ideas flojas con argumentos, valida las buenas y propone ángulos, filtrando por lo que esta fábrica puede construir (una persona, en semanas, con valor claro).",
      },
      {
        title: "Investigar ligero al vuelo",
        kind: "action",
        detail:
          "Cuando una afirmación se beneficia de evidencia real (¿duele de verdad?, ¿ya existe?), lanza una búsqueda rápida y acotada y trae los links, sin frenar la charla.",
        note: "Solo cuando ayuda",
        calls: [{ ref: "researcher", as: "agent", note: "pasada corta para traer evidencia" }],
      },
      {
        title: "Dejar borrador durable",
        kind: "safe",
        detail:
          "Vuelca la ESENCIA (no la transcripción) en factory/ideas/_drafts/<slug>.md: qué se considera, qué se descartó y por qué; permite retomar desde otra sesión sin tocar el tablero.",
        note: "No viola el gate de selección (DR-032)",
      },
      {
        title: "Cristalizar (a tu señal)",
        kind: "gate",
        detail:
          "Cuando la idea es tangible te lo ofrece sin presionar; cuando dices «llévalo al tablero», corre /new-idea sobre TODA la conversación.",
        calls: [
          { ref: "new-idea", as: "skill", note: "crea/actualiza la tarjeta desde la conversación" },
        ],
      },
    ],
    loop: "Conversar → rebatir → investigar → volcar borrador, hasta que des la señal de cristalizar.",
  },
  {
    slug: "new-idea",
    explainer:
      "Cristaliza una idea como una tarjeta en la base de ideas. Puede venir de una descripción concreta o de TODA una conversación de /explore. Sintetiza la idea, investiga ligeramente, le pone una puntuación (0-100) ponderada por tu perfil y crea la tarjeta en estado «Descubierta». Una tarjeta por idea: si ya existe una similar, la actualiza en vez de duplicar.",
    runsIn: "factory",
    steps: [
      {
        title: "Sintetizar de toda la conversación",
        kind: "action",
        detail:
          "Reconstruye la idea con TODO lo dicho, rebatido y concluido (no solo el último mensaje); si viene de /explore lee también su borrador. Si falta contexto, pregunta como mucho 2-3 cosas.",
      },
      {
        title: "Investigación ligera",
        kind: "action",
        detail:
          "Pasada rápida: ¿existen soluciones?, ¿hay evidencia del dolor?, ¿viabilidad obvia? No es la investigación profunda (esa es la fase de producto).",
        calls: [
          {
            ref: "researcher",
            as: "agent",
            note: "pasada rápida de existencia/evidencia/viabilidad",
          },
        ],
      },
      {
        title: "Puntuar (0-100)",
        kind: "action",
        detail:
          "Lee factory/profile.md para ponderar: dolor real (30%), facilidad de implementación (25%), retorno/valor (25%), encaje con tu perfil (20%). Documenta el razonamiento.",
      },
      {
        title: "Crear la tarjeta",
        kind: "safe",
        detail:
          "Crea factory/ideas/<slug>.md con frontmatter completo, status: discovered y la fecha de hoy. Si había un borrador de exploración, lo reemplaza.",
      },
      {
        title: "Reportar al owner",
        kind: "io",
        detail: "Resumen de la tarjeta, su puntuación y si la recomienda, con razonamiento corto.",
      },
    ],
  },
  {
    slug: "discover",
    explainer:
      "Busca en internet (Reddit, foros, reseñas, tendencias) oportunidades reales y las documenta como tarjetas. Mezcla DOS corrientes a ~50/50: oportunidades generales de alto retorno y oportunidades alineadas con tu perfil. El retorno no es solo dinero: la oportunidad (alcance, contactos) y el valor personal también cuentan.",
    runsIn: "factory",
    steps: [
      {
        title: "Leer el perfil",
        kind: "action",
        detail:
          "Lee factory/profile.md (intereses, activos, metas, apetito de monetización). Si no existe, lo dice y sugiere onboarding; puede seguir solo con la corriente general.",
      },
      {
        title: "Buscar en dos corrientes",
        kind: "action",
        detail:
          "Lanza al researcher en paralelo: A) oportunidades generales (quejas, reseñas negativas, tendencias); B) alineadas a tu perfil (que apalancan tus activos). Cada agente trae evidencia con links, no opiniones.",
        parallel: true,
        calls: [
          { ref: "researcher", as: "agent", note: "Corriente A — generales, con evidencia" },
          { ref: "researcher", as: "agent", note: "Corriente B — alineadas a tu perfil" },
        ],
      },
      {
        title: "Filtrar + deduplicar",
        kind: "action",
        detail:
          "Implementable por una persona en semanas, sin regulación pesada, con retorno claro; si la oportunidad ya existe en la base, añade la evidencia a esa tarjeta en vez de duplicar.",
      },
      {
        title: "Documentar las mejores",
        kind: "safe",
        detail:
          "Crea ~3-5 tarjetas por corriente (status: discovered) con puntuación y razonamiento; los descartes interesantes solo se listan.",
      },
      {
        title: "Reportar en dos bloques",
        kind: "io",
        detail:
          "«General» y «Alineadas contigo», cada una con su tabla (título, tipo, puntuación, retorno, dificultad); en las alineadas explica por qué encajan.",
      },
    ],
  },
  {
    slug: "recommend",
    explainer:
      "Analiza la base de ideas y te recomienda cuáles avanzar, con un ranking justificado alineado a tu perfil y al valor dual (dinero u oportunidad). Lo usas cuando preguntas «¿cuáles recomiendas?». Marca las elegidas como «recomendada», pero la selección final es TUYA (gate humano #1): se expresa corriendo /scaffold sobre la que quieras.",
    runsIn: "factory",
    steps: [
      {
        title: "Leer el perfil + las tarjetas",
        kind: "action",
        detail:
          "Lee factory/profile.md y todas las tarjetas (frontmatter + notas), ignorando la plantilla y los estados descartado/lanzado/en-pipeline.",
      },
      {
        title: "Re-validar puntuaciones viejas",
        kind: "action",
        detail:
          "Si una tarjeta es vieja o con evidencia floja, una pasada rápida confirma que la oportunidad sigue vigente.",
        note: "Solo para tarjetas viejas",
        calls: [{ ref: "researcher", as: "agent", note: "confirma vigencia" }],
      },
      {
        title: "Construir el ranking",
        kind: "action",
        detail:
          "Pondera puntuación, alineación con tu perfil, tipo de retorno, balance de portafolio (no 3 scrapers a la vez), esfuerzo disponible y quick wins (alto valor / baja dificultad primero).",
      },
      {
        title: "Presentar en dos bloques",
        kind: "io",
        detail:
          "«Mejores apuestas» y «Alineadas contigo»; por idea: qué es, por qué ahora, puntuación, retorno, dificultad y qué validaría la v1. Cierra con «cuáles NO y por qué».",
      },
      {
        title: "Marcar «recomendada» (decides tú)",
        kind: "gate",
        detail:
          "Marca status: recommended en sus elegidas. La selección final es TUYA: corres /scaffold sobre la que quieras (la mueve a in-pipeline); las demás las descartas desde Mission Control.",
        calls: [
          {
            ref: "scaffold",
            as: "skill",
            note: "lo corres sobre la idea elegida para crear el proyecto",
          },
        ],
      },
    ],
  },
  {
    slug: "spec",
    explainer:
      "Es el handoff + la fase de producto: toma la idea que le indicas por nombre, CREA su proyecto (carpeta/repo, hermano de la fábrica) y documenta el MVP con investigación + PRD + FRDs. Se corre DESDE la fábrica porque la carpeta aún no existe. Es el paso descubrimiento → documentado; de ahí en adelante trabajas DENTRO del proyecto.",
    runsIn: "factory",
    steps: [
      {
        title: "Leer la tarjeta + gate de demanda",
        kind: "gate",
        detail:
          "Lee la tarjeta. Si es monetaria/mixta, ANTES de crear nada hace un chequeo de demanda (¿competidores que cobran?, ¿quién paga?); si la señal falta o contradice la idea, PARA y recomienda kill/pivot.",
        note: "DR-042 — «un competidor que cobra = el mercado existe»",
      },
      {
        title: "Crear el proyecto (handoff)",
        kind: "safe",
        detail:
          "Crea <slug>/ como hermano de la fábrica, copia el overlay, inicializa git, crea repo privado, y escribe los enlaces bidireccionales (tarjeta → in-pipeline; fila en el portfolio). Nace en phase: product.",
        calls: [
          {
            ref: "scaffold",
            as: "skill",
            note: "ejecuta los pasos de creación de la carpeta/repo",
          },
        ],
      },
      {
        title: "Investigación profunda",
        kind: "action",
        detail:
          "Researchers en paralelo según el tipo de retorno: competidores, mercado, ancla de precio, fuentes/APIs, viabilidad, mercado/idioma de lanzamiento. Consolida en research.md.",
        parallel: true,
        calls: [
          {
            ref: "researcher",
            as: "agent",
            note: "competencia, fuentes, viabilidad, mercado (en paralelo)",
          },
        ],
      },
      {
        title: "PRD",
        kind: "action",
        detail:
          "El product-manager escribe el PRD: visión, usuarios, hipótesis de valor, monetización (decisión explícita v1-con-pagos sí/no), métricas, alcance mínimo v1 y plataforma objetivo.",
        calls: [{ ref: "product-manager", as: "agent", note: "redacta el PRD del MVP" }],
      },
      {
        title: "FRDs",
        kind: "action",
        detail:
          "Una carpeta-módulo por feature con criterios EARS testables (REQ/AC). Cada FRD de UI fija su fuente visual y exige fidelidad al mock.",
        calls: [{ ref: "product-manager", as: "agent", note: "redacta los FRDs (criterios EARS)" }],
      },
      {
        title: "Gate de avance",
        kind: "gate",
        detail:
          "Deja advance_pending: true y ESPERA tu «ok, avanza» (no escribe phase: design antes). Re-correr spec = seguir puliendo (no regenera). Siguiente: abrir el proyecto y correr /design.",
        note: "DR-032",
        calls: [{ ref: "design", as: "skill", note: "siguiente paso, ya dentro del proyecto" }],
      },
    ],
    loop: "Si ya existían PRD/FRDs, spec ITERA: refina con tu feedback (sin regenerar) y registra cada ronda en iteration.md.",
  },
  {
    slug: "design",
    explainer:
      "Fase de diseño UX/UI. Investiga referencias, fija el sistema de diseño (tokens + DESIGN.md) y produce mockups navegables que apruebas en un gate visual. Congela el contrato visual para que la implementación solo pueda usar los tokens — compensa que el diseño no sea tu fuerte. Se corre DENTRO del proyecto, tras /spec.",
    runsIn: "project",
    steps: [
      {
        title: "Ancla: escanear el repo primero",
        kind: "io",
        detail:
          "Antes de nada busca si ya hay un prototipo/diseño aprobado; si lo encuentra, el camino es ADOPT-VISUAL (fidelidad al prototipo); si no, EXPLORE (crear desde cero).",
        note: "DR-054 — dos caminos mutuamente excluyentes",
      },
      {
        title: "Sistema de diseño + voz",
        kind: "action",
        detail:
          "El diseñador reúne referencias y fija los tokens (paleta/tipografía/espaciado) y DESIGN.md; el copywriter escribe en paralelo la voz y el microcopy real (nunca lorem).",
        parallel: true,
        calls: [
          { ref: "designer", as: "agent", note: "referencias + sistema de diseño (tokens)" },
          { ref: "copywriter", as: "agent", note: "voz, tono y microcopy con claves i18n" },
        ],
      },
      {
        title: "3 direcciones (solo EXPLORE)",
        kind: "action",
        detail:
          "Si no había diseño, tres diseñadores generan 3 mockups navegables genuinamente distintos con el microcopy real. En ADOPT-VISUAL se EXTRAE fiel el prototipo aprobado y se salta este paso.",
        parallel: true,
        calls: [
          { ref: "designer", as: "agent", note: "dirección 1" },
          { ref: "designer", as: "agent", note: "dirección 2" },
          { ref: "designer", as: "agent", note: "dirección 3" },
        ],
      },
      {
        title: "Verificación automática (a11y)",
        kind: "safe",
        detail:
          "Captura screenshots a 375/1280px y corre accesibilidad (axe-core); arregla las violaciones serias ANTES de enseñártelo.",
      },
      {
        title: "GATE VISUAL (eliges tú)",
        kind: "gate",
        detail:
          "Te presenta las 3 direcciones (o el chequeo de fidelidad en ADOPT-VISUAL); eliges una o das feedback. Itera en sitio sin forzar avance; cada ronda se registra en iteration.md.",
        note: "DR-032 — elegir no obliga a avanzar",
      },
      {
        title: "Congelar el contrato + mocks por FRD + gate de avance",
        kind: "gate",
        detail:
          "Fija los tokens finales, el inventario components.md y trocea el diseño en mocks por cada FRD con UI. Verifica que los artefactos existen de verdad y, con tu «ok», pasa a phase: architecture.",
        note: "Un artefacto faltante es un not-done, no avanzable. Siguiente: /blueprint.",
        calls: [{ ref: "blueprint", as: "skill", note: "siguiente paso" }],
      },
    ],
    loop: "El gate visual se repite: cada ronda refina los mockups en sitio y añade una entrada a iteration.md (re-correr /design retoma, no regenera).",
  },
  {
    slug: "blueprint",
    explainer:
      "Fase de arquitectura. Produce DOS artefactos: el blueprint técnico (arquitectura, modelo de datos, ADRs, Build Plan) y las work orders listas para construir. Instala el stack y todas las puertas de calidad (lint/tests/e2e). Se corre DENTRO del proyecto, tras /design; es el paso diseño → arquitectura.",
    runsIn: "project",
    steps: [
      {
        title: "Preflight: ¿es proyecto Pandacorp?",
        kind: "safe",
        detail:
          "Confirma que existe .pandacorp/status.yaml; si falta, PARA y apunta a /adopt o /spec. Si el overlay está atrasado, corre /upgrade primero.",
        note: "DR-045/048",
        calls: [{ ref: "upgrade", as: "skill", note: "solo si el overlay está atrasado" }],
      },
      {
        title: "Propuesta de stack (apruebas tú)",
        kind: "gate",
        detail:
          "El arquitecto parte del stack recomendado, evalúa si hay algo mejor para ESTE proyecto y presenta la propuesta con trade-offs; espera tu visto bueno (gate ligero) antes de fijarla como ADR.",
        note: "DR-002 — las convenciones no se debaten; el stack sí lo apruebas",
        calls: [{ ref: "architect", as: "agent", note: "propone el stack" }],
      },
      {
        title: "Arquitectura + Build Plan",
        kind: "action",
        detail:
          "El arquitecto escribe la arquitectura de plataforma y un blueprint por FRD con su Build Plan (el DAG de work orders: orden, dependencias, qué va en paralelo, fundación primero) + los ADRs.",
        calls: [{ ref: "architect", as: "agent", note: "arquitectura + modelo de datos + ADRs" }],
      },
      {
        title: "Plan de eventos + deploy",
        kind: "action",
        detail:
          "Analytics traduce las métricas del PRD a un plan de eventos (sin PII); devops diseña el pipeline CI/CD, secretos y rollback (solo si el proyecto despliega).",
        parallel: true,
        calls: [
          { ref: "analytics", as: "agent", note: "plan de eventos" },
          { ref: "devops", as: "agent", note: "diseño de deploy" },
        ],
      },
      {
        title: "Instalar stack + puertas de calidad",
        kind: "action",
        detail:
          "Instala el stack y copia byte-a-byte la config canónica de gates (biome/knip/verify.sh) y la maquinaria e2e (smoke/visual/responsive/shell); cablea los puertos. Verifica que lint+typecheck+test corren limpios.",
        note: "DR-059 — nunca se editan a mano los archivos canónicos",
      },
      {
        title: "Work orders + gate de avance",
        kind: "gate",
        detail:
          "Genera las work orders gruesas por FRD (una vista/capacidad por WO) con su frontmatter de estado. Commitea, te presenta el plan (stack, coste, riesgos, nº de WOs) y espera tu «ok, a construir».",
        note: "DR-032. Siguiente: /implement.",
        calls: [
          { ref: "work-orders", as: "skill", note: "el motor de generación de work orders" },
          { ref: "implement", as: "skill", note: "siguiente paso" },
        ],
      },
    ],
    loop: "Si ya existía blueprint/work orders, ITERA: refina lo que hay (no regenera) y añade una entrada por ronda.",
  },
  {
    slug: "implement",
    explainer:
      "El comando que CONSTRUYE (y reanuda) un proyecto. Lanza un workflow dinámico que construye FEATURE POR FEATURE (FRD), con un gate de revisión por feature, y SIEMPRE con un supervisor en vivo que te avisa al celular si algo se atasca o termina. Corre en segundo plano, desatendido y reanudable: si se corta, lo vuelves a correr y sigue desde donde quedó (nunca reconstruye un FRD ya verificado).",
    runsIn: "project",
    steps: [
      {
        title: "Preflight",
        kind: "gate",
        detail:
          "¿Es un proyecto Pandacorp? Si falta el marcador, PARA y te apunta a adopt/spec. Si el overlay está atrasado, corre /upgrade primero (para que la maquinaria del build esté al día).",
        note: "DR-045/048",
        calls: [
          { ref: "upgrade", as: "skill", note: "si el overlay está atrasado" },
          { ref: "adopt", as: "skill", note: "si no es un proyecto de la fábrica todavía" },
          { ref: "spec", as: "skill", note: "para crear uno nuevo" },
        ],
      },
      {
        title: "Guarda de concurrencia",
        kind: "gate",
        detail:
          "Solo un build por proyecto a la vez. Si ya hay uno activo (heartbeat fresco), aborta; si el lock está viejo (el supervisor murió), lo limpia y sigue.",
        note: "DR-050",
      },
      {
        title: "Lanzar el workflow + fijar el techo",
        kind: "safe",
        detail:
          "Marca running:true, deja el lock, y lanza el workflow pandacorp-build con un tope de agentes (maxAgents) para no quemar tus tokens de noche. Cada FRD verificado será un commit (punto seguro).",
      },
      {
        title: "Montar el supervisor",
        kind: "action",
        detail:
          "Monta un vigilante que observa el build en vivo, late cada 20-30 min con «sigo, X/Y, todo verde», te avisa al celular en cada hito o atasco, y frena el build si pasa el techo o si demasiadas features se bloquean. El silencio NO es éxito.",
        note: "Esta es la parte que faltaba y dejaba builds corriendo a ciegas",
      },
      {
        title: "Construir cada FRD (en paralelo)",
        kind: "loop",
        detail:
          "Por cada feature construye sus work orders en oleadas, con TDD; cada WO se auto-testea y queda en revisión con una nota de hand-off.",
        parallel: true,
        calls: [
          { ref: "backend-dev", as: "agent", note: "datos + lógica + API" },
          { ref: "frontend-dev", as: "agent", note: "UI con los tokens" },
          { ref: "test-writer", as: "agent", note: "tests RED de los criterios" },
        ],
      },
      {
        title: "Gate de revisión por FRD",
        kind: "gate",
        detail:
          "El reviewer (otro modelo) revisa la feature completa con 3 lentes + tests adversariales + verify.sh. Verde → VERIFIED + commit. Si algo falla, intenta reparar (patch-first); si no puede, marca BLOCKED con motivo y sigue con features independientes.",
        note: "DR-015/073",
        calls: [{ ref: "reviewer", as: "agent", note: "revisa el FRD completo y corre verify.sh" }],
      },
      {
        title: "Drenar la cola de cambios",
        kind: "action",
        detail:
          "En cada punto seguro lee tu cola de cambios (lo que filtraste con /change): integra los listos vía iterate/bug, deja los que te necesitan en decisions.md, y archiva los hechos. Nunca a media feature.",
        note: "DR-069 — así le hablas a un build en marcha",
        calls: [
          { ref: "change", as: "skill", note: "la cola que el build drena" },
          { ref: "iterate", as: "skill", note: "integra cambios/features" },
          { ref: "bug", as: "skill", note: "integra fixes con test de regresión" },
          { ref: "decide", as: "skill", note: "responde lo que necesita tu decisión" },
        ],
      },
      {
        title: "Reanudar para varias pasadas + apagado garantizado",
        kind: "safe",
        detail:
          "Una corrida hace UNA pasada; el supervisor relanza hasta que no quede nada o se alcance el techo. Para parar TODO el build pones la señal de stop (rethink_pending), no solo paras una corrida. Al terminar por cualquier razón deja running:false (nunca una bandera mentirosa).",
        note: "DR-068",
      },
    ],
    loop: "El loop por FRD vive en el script (reanudable): relee el estado del frontmatter y nunca reconstruye un FRD ya VERIFIED.",
  },
  {
    slug: "release",
    explainer:
      "DESPLIEGA / LANZA una versión —interno (en local, sin servidor externo) o externo (Vercel, AWS…)— y deja el proyecto en fase release. El endurecimiento (seguridad, calidad, métricas/telemetría) es el ÚLTIMO paso de la CONSTRUCCIÓN, no del release: cuando una versión llega aquí ya está auditada. release revalida que ese endurecimiento está verde, prepara la landing/checklist y pasa por el gate humano de producción. Se corre DENTRO del proyecto cuando la construcción de una versión está completa.",
    runsIn: "project",
    steps: [
      {
        title: "Preflight",
        kind: "safe",
        detail: "Confirma que es un proyecto Pandacorp y que el overlay está al día.",
        note: "DR-045",
        calls: [{ ref: "upgrade", as: "skill", note: "si el overlay está atrasado" }],
      },
      {
        title: "Auditoría de seguridad",
        kind: "gate",
        detail:
          "El auditor revisa OWASP web (y OWASP Agentic si hay LLMs con herramientas); los hallazgos críticos/altos BLOQUEAN y se arreglan antes de seguir.",
        note: "DR-017 — bloqueo real",
        calls: [{ ref: "security-auditor", as: "agent", note: "auditoría OWASP" }],
      },
      {
        title: "Landing + telemetría",
        kind: "action",
        detail:
          "El copywriter escribe la copy de la landing del MVP (y el plan de distribución si es monetaria); analytics verifica con evidencia que los eventos disparan de verdad.",
        parallel: true,
        note: "DR-042 — «desplegado ≠ lanzado»",
        calls: [
          { ref: "copywriter", as: "agent", note: "copy de landing + plan de distribución" },
          { ref: "analytics", as: "agent", note: "verifica el funnel de la hipótesis" },
        ],
      },
      {
        title: "Checklist pre-release + deploy a staging",
        kind: "safe",
        detail:
          "Todo verificado con comandos (suite + e2e verdes, migraciones probadas, health check); el devops despliega a staging y corre un smoke e2e contra la URL real.",
        calls: [{ ref: "devops", as: "agent", note: "deploy a staging + smoke" }],
      },
      {
        title: "GATE HUMANO — producción",
        kind: "gate",
        detail:
          "Te presenta el resumen (URL de staging, resultado de la auditoría, costes, aviso de Vercel Pro si cobra) y dispara un push; espera tu aprobación explícita, sin excepciones.",
        note: "DR-004/035/038 — nada sale a producción sin tu OK",
      },
      {
        title: "Producción + cierre",
        kind: "action",
        detail:
          "Tras tu aprobación, devops despliega (externo a producción, o interno en local) con verificación post-deploy y rollback listo; tag de versión, changelog, status → release (ya lanzado). Desde aquí iteras con /new-version o /iterate; no hay una fase «operation» aparte.",
        calls: [
          { ref: "devops", as: "agent", note: "producción + rollback" },
          { ref: "review-launch", as: "skill", note: "después, para leer las métricas reales" },
        ],
      },
    ],
  },
  {
    slug: "review-launch",
    explainer:
      "Cierra la mitad posterior del arco económico: lee las métricas REALES del producto (PostHog) contra la hipótesis de valor y las kill-signals del PRD, y te da un veredicto kill / hold / double-down. NO mata nada solo — matar/archivar es tu decisión. Es la iteración post-lanzamiento: corre en un proyecto ya en release (lanzado), a demanda o como job /loop sobre el portfolio.",
    runsIn: "project",
    steps: [
      {
        title: "Leer los objetivos (PRD)",
        kind: "io",
        detail:
          "Del PRD toma la hipótesis de valor, las métricas de éxito y las kill-signals con sus umbrales; del origen de la idea, el tipo de retorno que decide qué métrica importa.",
        note: "DR-043",
      },
      {
        title: "Leer las métricas reales",
        kind: "io",
        detail:
          "Lee de PostHog los eventos del plan para la ventana: adquisición, activación, retención y la métrica de retorno. Sin números inventados: si el dato no está, lo dice.",
      },
      {
        title: "Comparar y emitir veredicto",
        kind: "action",
        detail:
          "Contrasta lo real contra la hipótesis y produce uno de tres: DOUBLE DOWN (aguantó → siguiente movimiento), HOLD (no concluyente → seguir midiendo) o KILL/ARCHIVE (saltó una kill-signal). Cada veredicto cita los números reales.",
      },
      {
        title: "Actualizar el portfolio + reportar",
        kind: "gate",
        detail:
          "Escribe en el portfolio las columnas de negocio (usuarios / retorno / último veredicto) y te reporta con un push si necesita tu decisión. Matar/archivar siguen siendo gate humano: el loop recomienda, tú decides.",
        note: "DR-038",
      },
    ],
    loop: "Diseñado para correr como job /loop sobre el portfolio: sin humano presente solo mide, registra y notifica — nunca mata por su cuenta.",
  },
  {
    slug: "iterate",
    explainer:
      "El MOTOR de integración de cambios de un proyecto: añade una feature o un ajuste en cualquier momento (en construcción o ya lanzado). Tú describes el cambio y el PM/arquitecto decide el tamaño mínimo (reabrir una work order, una FRD nueva, o un mini paso de diseño) y lo mete en la cola de build. Es el mecanismo de iteración del día a día; internamente lo invocan /change y el propio build al drenar la cola.",
    runsIn: "project",
    steps: [
      {
        title: "Preflight",
        kind: "gate",
        detail:
          "Comprueba el marcador .pandacorp/status.yaml; si falta, para y te manda a /adopt o /spec. Si el overlay está atrasado, corre /upgrade antes.",
        calls: [
          { ref: "adopt", as: "skill", note: "si no es proyecto factory" },
          { ref: "upgrade", as: "skill", note: "si el overlay está atrasado" },
        ],
      },
      {
        title: "Triaje de impacto (decide el tamaño)",
        kind: "action",
        detail:
          "El PM/arquitecto clasifica en tres casos: ajuste pequeño (reabre una WO existente), feature nueva (mini-pipeline con FRD nueva), o cambio fundamental (muestra el radio de impacto y pide pausar el build).",
        parallel: true,
        calls: [
          { ref: "researcher", as: "agent", note: "investiga si es módulo nuevo" },
          { ref: "product-manager", as: "agent", note: "crea la FRD nueva" },
          {
            ref: "architect",
            as: "agent",
            note: "blueprint de la feature + ADR si toca plataforma",
          },
        ],
      },
      {
        title: "Generar/ajustar work orders",
        kind: "action",
        detail:
          "Crea o reabre las work orders bajo la FRD afectada; si trae UI nueva, un mini paso de diseño acotado.",
        calls: [
          { ref: "work-orders", as: "skill", note: "genera las WO de la feature" },
          { ref: "design", as: "skill", note: "mini diseño si hay UI nueva" },
        ],
      },
      {
        title: "Encolar y construir",
        kind: "action",
        detail:
          "Entra al loop de /implement; si el proyecto estaba lanzado, su fase vuelve a implementation mientras se trabaja y al terminar va a /release.",
        calls: [{ ref: "implement", as: "skill" }],
      },
      {
        title: "Regresión + estado",
        kind: "safe",
        detail:
          "Los tests existentes deben seguir verdes; cada fix se registra con su test de regresión y se actualiza status.yaml.",
      },
    ],
    loop: "Re-ejecutar iterate sobre lo mismo lo refina sin regenerar; el build drena la cola en cada punto seguro e invoca esta lógica para integrar cada cambio.",
  },
  {
    slug: "change",
    explainer:
      "La ÚNICA puerta de entrada para pedirle a un proyecto CUALQUIER cambio: una feature, un ajuste o un bug. Lo describes en lenguaje llano y lo clasifica (feature/cambio vs bug), le da una clase de urgencia y lo archiva en la cola .pandacorp/inbox/changes/. Solo captura y clasifica: NUNCA edita docs ni código y NO necesita saber si hay un build corriendo (por eso es seguro). El build drena la cola en su próximo punto seguro.",
    runsIn: "project",
    steps: [
      {
        title: "Preflight",
        kind: "gate",
        detail:
          "Escribe en .pandacorp/inbox/, así que confirma el marcador; si falta, para y apunta a /adopt o /spec.",
        calls: [
          { ref: "adopt", as: "skill" },
          { ref: "spec", as: "skill" },
          { ref: "upgrade", as: "skill" },
        ],
      },
      {
        title: "Capturar + clasificar el TIPO",
        kind: "action",
        detail:
          "Decide si es bug (algo roto), feature/cambio (capacidad o ajuste) o una respuesta a una pregunta del build (eso se redirige a /decide). Pregunta lo mínimo; no investiga ni arregla.",
        calls: [
          {
            ref: "decide",
            as: "skill",
            note: "si en realidad es responder algo que el build preguntó",
          },
        ],
      },
      {
        title: "Asignar la CLASE de servicio",
        kind: "action",
        detail:
          "Urgencia tipo Kanban: «expedite» (urgente/rompe algo → el build lo salta al frente) o «standard» (normal, FIFO, por defecto).",
      },
      {
        title: "Escribir la change-request en la cola",
        kind: "io",
        detail:
          "Crea .pandacorp/inbox/changes/<slug>.md (frontmatter máquina en inglés: type/class/status draft|ready; cuerpo en español) e incrementa pending_changes.",
        note: "status «ready» = el build lo construye; «draft» = aparcado, el build lo SALTA hasta promoverlo",
      },
      {
        title: "Confirmar al owner",
        kind: "action",
        detail:
          "Te dice (en español) que quedó anotado como [tipo · clase] y que el build lo toma en su próximo punto seguro; si no hay build, corre /implement y lo recoge.",
        calls: [{ ref: "implement", as: "skill", note: "para que el build recoja la cola" }],
      },
    ],
    loop: "Aparcas ideas medio formadas como «draft» y las promueves a «ready» con un solo cambio; al completarse, el build verifica el registro durable, marca «done» y MUEVE el archivo a changes/done/ (nunca borra).",
  },
  {
    slug: "bug",
    explainer:
      "El canal para REPORTAR un bug que encuentras probando, sin parar el build. Lo describes en lenguaje llano y queda anotado en la cola unificada de cambios (como type: bug). No arregla NADA: solo documenta. El /implement que esté corriendo lo drena en su próximo punto seguro y lo arregla con un test de regresión. Es uno de los motores internos que invoca la puerta única /change.",
    runsIn: "project",
    steps: [
      {
        title: "Preflight",
        kind: "gate",
        detail:
          "Escribe en .pandacorp/inbox/, confirma el marcador; si falta, para y apunta a /adopt o /spec.",
        calls: [
          { ref: "adopt", as: "skill" },
          { ref: "spec", as: "skill" },
        ],
      },
      {
        title: "Capturar la descripción",
        kind: "action",
        detail:
          "Si falta algo clave para reproducir, pregunta lo MÍNIMO (pasos, esperado vs ocurrido, en qué pantalla). No investiga a fondo ni intenta arreglar.",
      },
      {
        title: "Escribir el parte de bug",
        kind: "io",
        detail:
          "Crea .pandacorp/inbox/changes/<slug>.md (type: bug, class expedite si bloquea un flujo; cuerpo en español con pasos/esperado/actual) y sube pending_changes.",
      },
      {
        title: "Confirmar al owner",
        kind: "action",
        detail:
          "Te dice que quedó anotado y que /implement lo tomará en su próximo punto seguro (escribe primero el test de regresión, luego el fix).",
        note: "si era una feature, redirige a /iterate; si era responder algo de la IA, a /decide",
        calls: [
          { ref: "iterate", as: "skill", note: "si en realidad es una feature" },
          { ref: "decide", as: "skill", note: "si era responder una pregunta del build" },
        ],
      },
    ],
    loop: "Un bug en la cola nunca se borra a mano: al cerrarlo, el loop de /implement lo marca resuelto con el commit del fix.",
  },
  {
    slug: "decide",
    explainer:
      "El mecanismo para que TÚ respondas los puntos de decisión que la IA dejó pendientes (cosas que solo el dueño decide: alcance de producto, gastar dinero, algo irreversible). Mission Control los muestra (solo lectura); este skill los RESUELVE. Es la dirección opuesta a /change: aquí contestas algo que el build preguntó.",
    runsIn: "project",
    steps: [
      {
        title: "Leer las decisiones pendientes",
        kind: "io",
        detail:
          "Lee .pandacorp/inbox/decisions.md y lista las pendientes; para cada una muestra la pregunta, las opciones investigadas y la recomendación de la IA con su razonamiento.",
      },
      {
        title: "Pedir tu respuesta",
        kind: "gate",
        detail:
          "Te presenta cada pendiente y pregunta qué decides (puedes decir «tu recomendación»). Nunca decide por ti: lo que no contestes sigue pendiente.",
      },
      {
        title: "Registrar la respuesta",
        kind: "io",
        detail:
          "Escribe en decisions.md: resuelta, tu decisión literal, el razonamiento y la fecha. Una decisión resuelta no se borra, se marca resuelta (trazabilidad).",
      },
      {
        title: "Si es arquitectónica, ADR",
        kind: "action",
        detail:
          "Si la decisión es de arquitectura, además crea/actualiza el ADR en docs/adr/ con lo decidido y el trade-off.",
      },
      {
        title: "Desbloquear",
        kind: "action",
        detail:
          "Si desbloqueaba un frente, lo dice y actualiza pending_decisions; si /implement corre, lo recoge en su próximo punto seguro; si no, ofrece reanudar.",
        calls: [{ ref: "implement", as: "skill", note: "si no hay build activo, ofrece reanudar" }],
      },
    ],
  },
  {
    slug: "new-version",
    explainer:
      "Agrupa un lote GRANDE de cambios en un hito formal (v2, v3…) de un proyecto ya lanzado, con su propio mini-PRD. Es OPCIONAL: para el día a día usa /iterate. new-version es solo para rediseños o paquetes grandes que justifican un PRD nuevo.",
    runsIn: "project",
    steps: [
      {
        title: "Preflight",
        kind: "gate",
        detail:
          "Confirma el marcador; si falta, para y apunta a /adopt o /spec. Corre /upgrade si el overlay está atrasado.",
        calls: [
          { ref: "adopt", as: "skill" },
          { ref: "upgrade", as: "skill" },
        ],
      },
      {
        title: "Definir la versión",
        kind: "action",
        detail:
          "Con el product-manager convierte el objetivo en alcance concreto: qué FRDs nuevas, qué FRDs cambian, qué queda fuera. Incrementa version: en status.yaml.",
        calls: [{ ref: "product-manager", as: "agent" }],
      },
      {
        title: "Re-entrar al pipeline solo en lo que cambia",
        kind: "action",
        detail:
          "FRD nueva = nuevo módulo; pantallas nuevas → mini diseño; impacto arquitectónico → blueprint de la feature + ADR; work orders nuevas o reabrir una existente.",
        calls: [
          { ref: "design", as: "skill", note: "si hay cambios visuales" },
          { ref: "work-orders", as: "skill", note: "para las WO nuevas" },
        ],
      },
      {
        title: "Implementación + release",
        kind: "action",
        detail:
          "Mismo loop de /implement (regresión completa: los tests de versiones anteriores deben seguir verdes); luego /release con los mismos gates y sincroniza el portfolio.",
        calls: [
          { ref: "implement", as: "skill" },
          { ref: "release", as: "skill" },
          { ref: "sync-portfolio", as: "skill" },
        ],
      },
    ],
    loop: "La numeración de FRD/work-order nunca se reinicia: el historial del proyecto es continuo. No se tocan los contratos congelados sin un ADR que lo justifique.",
  },
  {
    slug: "adopt",
    explainer:
      "Adopta un proyecto EXISTENTE que NO nació del handoff (brownfield/externo) y lo trae bajo la fábrica. Inyecta el overlay sin pisar nada, infiere la fase real desde el código, reconstruye docs as-built mínimos, lo registra en el portfolio con una idea retroactiva y entrega a los skills normales. Corre DENTRO del proyecto existente. Es el espejo brownfield de /scaffold.",
    runsIn: "project",
    steps: [
      {
        title: "Sanity check",
        kind: "gate",
        detail:
          "Si ya existe .pandacorp/status.yaml, dice que ya está adoptado y para. Confirma que hay código real (si está vacío, eso es /spec).",
      },
      {
        title: "Leer el proyecto para entenderlo (sin escribir)",
        kind: "action",
        detail:
          "Inspecciona stack/estructura, git, y señales de madurez para INFERIR la fase (deploy vivo, ya lanzado → release; código+tests → implementation; solo boilerplate → architecture) e inventaria el diseño existente.",
      },
      {
        title: "Presentar el plan de adopción (GATE HUMANO)",
        kind: "gate",
        detail:
          "En español, antes de escribir: qué archivos CREA vs FUSIONA (nunca sobrescribe), la fase inferida + evidencia, te pregunta el tipo de retorno y confirma la referencia visual. Push al celular. Si dices «no», no cambia nada.",
        note: "tocar un proyecto existente siempre es gate humano (DR-045/038)",
      },
      {
        title: "Inyectar el overlay + estructura + reglas",
        kind: "io",
        detail:
          "Copia el overlay sin pisar (archivos nuevos tal cual, CLAUDE.md/AGENTS.md por anexado), crea el esqueleto docs/, escribe status.yaml con la fase inferida y target_platforms: desktop (conservador), e inyecta las reglas de ingeniería del stack.",
      },
      {
        title: "Reconstruir docs as-built + adoptar el visual",
        kind: "action",
        detail:
          "El PM escribe PRD + FRDs de lo que la app hace HOY; el architect el architecture.md real + ADR-000; el designer extrae los tokens del diseño existente y lo congela como contrato (captura también el app shell como fundación).",
        parallel: true,
        calls: [
          { ref: "product-manager", as: "agent" },
          { ref: "architect", as: "agent" },
          { ref: "designer", as: "agent" },
        ],
      },
      {
        title: "Registrar en la fábrica + commit",
        kind: "io",
        detail:
          "Crea la idea retroactiva (in-pipeline), la fila del portfolio y los enlaces bidireccionales; commit solo del overlay+docs (nunca el código). Reporta y apunta al siguiente skill según la fase.",
        calls: [
          { ref: "implement", as: "skill", note: "siguiente si está en implementación" },
          { ref: "review-launch", as: "skill", note: "siguiente si ya está en release (lanzado)" },
        ],
      },
    ],
    loop: "Nunca sobrescribe archivos del proyecto (crea o fusiona) ni reescribe el código existente; las docs as-built siempre se marcan como reconstruidas.",
  },
  {
    slug: "sync-portfolio",
    explainer:
      "Sincroniza la fábrica con sus proyectos: detecta tarjetas movidas en el kanban de ideas (cambios de status en el frontmatter) y refresca el estado de cada proyecto leyendo su status.yaml. Corre EN la fábrica, a demanda o como job periódico. Sin humano presente solo reporta y registra.",
    runsIn: "factory",
    steps: [
      {
        title: "Detectar tarjetas movidas",
        kind: "action",
        detail:
          "Compara el status actual de cada tarjeta contra el snapshot previo y lista los cambios.",
      },
      {
        title: "Actuar según el nuevo status",
        kind: "action",
        detail:
          "«recomendada» → avisa que está lista para /scaffold; «descartada» → verifica que tenga el motivo anotado; otros cambios → solo los registra.",
        calls: [{ ref: "scaffold", as: "skill", note: "solo si pediste modo automático" }],
      },
      {
        title: "Refrescar el portfolio",
        kind: "io",
        detail:
          "Para cada fila lee el status.yaml del proyecto y actualiza fase/resumen/fecha de sync. NO calcula métricas de negocio (eso lo hace /review-launch).",
      },
      {
        title: "Rutas rotas + reporte",
        kind: "safe",
        detail:
          "Ruta rota: NO borra la fila, la marca «⚠️ ruta no encontrada» con el paso de recuperación. Reporta tarjetas movidas, estado de cada proyecto y discrepancias.",
      },
    ],
    loop: "Sin humano presente no corre scaffolds automáticos salvo instrucción previa explícita: solo reporta y registra.",
  },
  {
    slug: "learn",
    explainer:
      "Le enseña a la fábrica algo DURABLE: un estándar de ingeniería, una regla de decisión, o un skill nuevo (la autoría del skill se delega al skill-creator nativo). Es la etapa APLICAR/PROMOVER del bucle de autoaprendizaje. Corre EN la fábrica. Promover es ALTO RIESGO: siempre es tu decisión. Lo disparan los botones «Nuevo estándar/regla/skill» de Mission Control.",
    runsIn: "factory",
    steps: [
      {
        title: "Clasificar qué se pide",
        kind: "action",
        detail:
          "¿Es un estándar (cómo se construye), una regla de decisión (un default pre-aprobado), o un skill (capacidad nueva)? Dos entradas: enseñas algo fresco, o promueves una lección de factory/memory/.",
      },
      {
        title: "Investigar lo mínimo",
        kind: "action",
        detail: "Delega al researcher si hace falta para concretar valores y cómo se verifica.",
        calls: [{ ref: "researcher", as: "agent", note: "si necesita valores concretos" }],
      },
      {
        title: "Si es ESTÁNDAR: escribir + PROPAGAR",
        kind: "action",
        detail:
          "Escríbelo (Regla · Cómo se verifica · Porqué), propágalo a la librería de reglas inyectable + cablea lo duro en verify.sh + SUBE OVERLAY_VERSION (el disparador que lo lleva a los proyectos vía /upgrade).",
        note: "DR-051 — un estándar que no se inyecta está muerto",
        calls: [
          { ref: "upgrade", as: "skill", note: "el bump de OVERLAY lo lleva a los proyectos" },
        ],
      },
      {
        title: "Si es REGLA DE DECISIÓN",
        kind: "action",
        detail:
          "Añade DR-NNN a registry.yaml con pattern, default, requires_human y nota; si los valores viven en un estándar, apunta a él.",
      },
      {
        title: "Si es SKILL: delegar a skill-creator",
        kind: "gate",
        detail:
          "Justifica primero (un skill nace de un hueco MEDIDO, no de una corazonada). El skill-creator nativo hace la autoría + eval; acéptalo solo si mejora el benchmark. Es gate del owner.",
      },
      {
        title: "Confirmar + ritual de activación",
        kind: "action",
        detail:
          "Confirma qué se creó/cambió y recuerda activarlo: commit + «claude plugin update» + reiniciar (si tocaste el plugin). Mission Control avisa de la deriva.",
      },
    ],
    loop: "Al promover una lección de memory, back-link: añade el estándar/DR/skill al «links:» de la lección y pon promotion: approved (o rejected si la rechazas). Nunca se borra la lección.",
  },
  {
    slug: "memory",
    explainer:
      "Opera la memoria de autoaprendizaje (factory/memory/). Dos modos: «harvest» extrae lecciones durables (problema→solución, veredictos de librería, patrones, gotchas) de un proyecto como candidatas; «review» audita el almacén (obsoletas, contradichas, duplicadas) y propone deprecaciones/promociones. Corre EN la fábrica. PROPONE; promover es /learn + tú. Nunca promueve por sí mismo.",
    runsIn: "factory",
    steps: [
      {
        title: "harvest: cosechar (librarian)",
        kind: "action",
        detail:
          "Delega en el librarian: drena los inboxes crudos y lee los puntos de captura (bugs, progress, reviews, decisions, veredicto de lanzamiento) y escribe lecciones candidatas ancladas a evidencia, deduplicando.",
        calls: [{ ref: "librarian", as: "agent" }],
      },
      {
        title: "harvest: eval-gate + reporte",
        kind: "gate",
        detail:
          "Una candidata pasa a «activa» solo si es schema-válida Y corroborada (≥2× o confirmada por un resultado real) Y no contradice una de mayor confianza; el resto queda «candidata». Nada se promovió a estándar/regla/skill.",
      },
      {
        title: "review: auditar (librarian)",
        kind: "action",
        detail:
          "El librarian escanea memory/ y propone: deprecar (vieja sin uso), reconciliar (contradicha), fusionar (casi-duplicadas), o promover (recurre en ≥2 proyectos → promotion: proposed).",
        calls: [{ ref: "librarian", as: "agent" }],
      },
      {
        title: "review: aplicar lo seguro / proponer",
        kind: "safe",
        detail:
          "Aplica solo lo seguro y reversible (deprecar, fusionar duplicados claros) — nunca borra un archivo. Las promociones se proponen; al aprobar, se enrutan a /learn.",
        calls: [{ ref: "learn", as: "skill", note: "tras tu aprobación, para promover" }],
      },
      {
        title: "status: resumir el almacén",
        kind: "io",
        detail:
          "Modo status: cuentas por tipo/estado, la cola de promociones, las más aplicadas, las más viejas sin uso y las candidatas pendientes de corroborar.",
      },
    ],
    loop: "Cadencia: la captura es siempre-on al inbox crudo; harvest (refinar) corre como barrido /loop sobre el portfolio + a demanda (lo surge el recordatorio de salud de memoria de Mission Control).",
  },
  {
    slug: "scaffold",
    explainer:
      "Crea la carpeta/repo de un proyecto a partir de una idea (el paso mecánico del handoff). Normalmente lo invoca /spec; se usa suelto solo para crear el proyecto sin documentar todavía. El proyecto nace solo con docs + overlay + las reglas; NO se instala el stack (eso lo decide /blueprint).",
    runsIn: "factory",
    steps: [
      {
        title: "Validar la tarjeta",
        kind: "gate",
        detail:
          "Lee la idea; debe existir y estar en «recomendada» (o «descubierta»). Correr este skill ES tu selección. Si está descartada o ya en pipeline, para y confirma.",
      },
      {
        title: "Crear la carpeta + git",
        kind: "io",
        detail:
          "Crea <slug>/ como HERMANA de la fábrica (nunca dentro), por defecto el directorio padre o tu projects_path. Inicializa git con rama main.",
      },
      {
        title: "Copiar el overlay + estructura + reglas + puertos",
        kind: "io",
        detail:
          "Copia el overlay (procesando variables), crea el esqueleto docs/ feature-céntrico sin pre-stub, inyecta las reglas «always», y reserva un bloque de puertos dev (cero colisiones por construcción).",
      },
      {
        title: "Enlaces bidireccionales + repo + commit",
        kind: "action",
        detail:
          "Tarjeta → in-pipeline + project:; fila en el portfolio; crea repo privado con gh si está disponible; commit «scaffold project». Reporta la ruta y el siguiente paso: /spec.",
        calls: [{ ref: "spec", as: "skill", note: "siguiente paso, dentro del proyecto" }],
      },
    ],
    loop: "Si la carpeta destino ya existe, para y pregunta — nunca sobrescribe. Slug en inglés kebab-case; nunca crear el proyecto dentro de la fábrica.",
  },
  {
    slug: "work-orders",
    explainer:
      "Descompone las FRDs + el blueprint en work orders GRUESAS (una vista/página/capacidad cohesiva, no un componente atómico). Normalmente las crea /blueprint; se usa suelto solo para regenerarlas o ajustarlas. Corre DENTRO del proyecto.",
    runsIn: "project",
    steps: [
      {
        title: "Leer FRDs + blueprints + arquitectura",
        kind: "io",
        detail:
          "Lee todas las FRDs v1, el blueprint de cada FRD (con su Build Plan) y la arquitectura de plataforma.",
      },
      {
        title: "Generar las work orders por-FRD",
        kind: "io",
        detail:
          "Crea las WO desde la plantilla. El frontmatter es la fuente de verdad: implementation_status: PLANNED, artifacts (lo que escribe), difficulty (low/medium/high), con los criterios EARS copiados inline.",
      },
      {
        title: "Reuso antes de crear + referencia visual",
        kind: "action",
        detail:
          "Cada WO de UI lista qué componentes existentes reusa y lleva su «referencia visual» materializada (el mock + el slice de tokens) + un criterio de fidelidad. Recrear un primitivo del inventario es construir un defecto.",
        note: "DR-054/056/057",
      },
      {
        title: "Granularidad gruesa + orden + estado",
        kind: "io",
        detail:
          "Una WO = una vista/capacidad cohesiva; dos WO de la misma ola no escriben el mismo archivo (artifacts disjuntos). El orden vive en el Build Plan. Actualiza status.yaml. Siguiente: /implement.",
        calls: [{ ref: "implement", as: "skill", note: "siguiente paso" }],
      },
    ],
    loop: "El estado vive en el frontmatter (PLANNED→IN_PROGRESS→IN_REVIEW→VERIFIED, +BLOCKED), nunca en prosa; el motor solo construye PLANNED/IN_PROGRESS y nunca reconstruye VERIFIED.",
  },
  {
    slug: "upgrade",
    explainer:
      "Pone al día el overlay de un proyecto (la capa .pandacorp/, los imports de CLAUDE.md/AGENTS.md y la maquinaria de build) a la versión actual de la fábrica. Corre DENTRO de un proyecto. Detecta el salto, migra la estructura si hace falta, regenera la capa gestionada de forma no-destructiva, sube overlay_version y commitea solo. Los saltos compatibles se aplican en silencio; uno breaking se anuncia. Normalmente lo dispara el preflight de otro skill.",
    runsIn: "project",
    steps: [
      {
        title: "Detectar el salto",
        kind: "action",
        detail:
          "Compara el overlay_version del proyecto con el OVERLAY_VERSION del plugin. En sync = para. Compatible (mismo MAJOR) = silencioso; MAJOR = anuncia primero con el diff.",
      },
      {
        title: "Migrar la estructura si hace falta",
        kind: "action",
        detail:
          "Mueve la capa de integración a .pandacorp/ y reestructura docs/ a feature-céntrico si viene de un layout antiguo, preservando los IDs estables (solo cambia su ubicación, nunca los números).",
      },
      {
        title: "Regenerar la capa gestionada + conformance de gates",
        kind: "io",
        detail:
          "Regenera guide.md y la maquinaria de build, reconcilia CLAUDE.md/AGENTS.md sin tocar tus notas, re-sincroniza docs/rules/ según el stack, y hace overwrite-on-drift de verify.sh/biome/knip + los archivos e2e canónicos.",
        note: "DR-059 — nunca toca los per-project routes.ts/shell.ts (se crean vacíos si faltan)",
      },
      {
        title: "Back-fill conservador + bump + commit",
        kind: "safe",
        detail:
          "Si falta target_platforms, añade «desktop» (no responsive, para no bloquear commits). Pone overlay_version al target, registra en el decision-log, commit «upgrade overlay» y reporta.",
        note: "DR-074 — el owner promueve a responsive cuando esté verificado",
      },
    ],
    loop: "Idempotente: re-correr estando en sync es no-op. Los gates canónicos se editan en la FUENTE (templates), nunca in-place — la conformance los sobrescribe en el próximo /upgrade (DR-076).",
  },
  {
    slug: "sync",
    explainer:
      "El flujo INVERSO: cuando editas el código a mano (para ir rápido o verlo en vivo) fuera de spec→implement/change, el código se adelanta a los docs; sync los pone al día desde el código (código→docs), el reverso de iterate. Es EXHAUSTIVO (propaga cada cambio por toda su cascada de docs) y honesto: el código se vuelve el oráculo, así que DOCUMENTA pero nunca VERIFICA — tú aportas la intención en un gate. Corre DENTRO del proyecto.",
    runsIn: "project",
    steps: [
      {
        title: "Detectar contexto y modo",
        kind: "gate",
        detail:
          "Confirma que es un proyecto (modo proyecto). Con contexto = parte de los cambios de la charla (pero verifica el diff real); SIN contexto = auditoría completa en frío: recorre toda la app contra los docs y encuentra todos los gaps.",
        note: "un cambio a mano en el plugin/la fábrica se deriva a /learn",
        calls: [{ ref: "learn", as: "skill", note: "si editaste el plugin o la fábrica a mano" }],
      },
      {
        title: "Clasificar cada divergencia — la dirección decide",
        kind: "action",
        detail:
          "El código adelantó al doc → documentar; un cambio deliberado → actualizar el doc. Pero si el DOC tiene razón, NO lo degrada: un bug (código que contradice un doc correcto) se deriva a /change|/bug, y una feature documentada-pero-no-construida se marca pendiente. La especificación nunca se rebaja para describir un código roto.",
        calls: [
          { ref: "change", as: "skill", note: "si la divergencia es un bug a arreglar" },
          { ref: "bug", as: "skill", note: "el motor que integra el fix con test de regresión" },
        ],
      },
      {
        title: "Expandir la cascada completa",
        kind: "action",
        detail:
          "Para lo que SÍ se documenta, propaga por toda la cascada: comportamiento → FRD + work order(s) + fdd; arquitectura → blueprint + ADR + architecture.md; UI → fdd + tokens/components; scope → PRD. Barre docs/ y .pandacorp/. Nada se queda sin documentar.",
      },
      {
        title: "GATE de intención (lo decides tú)",
        kind: "gate",
        detail:
          "Te presenta el plan y clasificas cada divergencia en una acción: documentar · actualizar-doc · es-bug · pendiente · experimento. Es el oráculo independiente que el skill no tiene — el único sitio donde un bug se distingue de un cambio deliberado.",
        note: "el código no revela la intención; solo tú",
      },
      {
        title: "Escribir + dos capas + Claude Design",
        kind: "safe",
        detail:
          "Escribe cada doc bendecido marcado reconciled-from-code, registra la entrada en docs/decision-log.md (te PREGUNTA el porqué), refresca status.yaml y corre el doc-lint. Si el diseño tiene espejo en Claude Design, AVISA y OFRECE re-sincronizarlo vía /design-sync (nunca empuja solo, es una escritura hacia afuera tras tu login).",
      },
    ],
    loop: "sync documenta lo que el código hizo de MÁS; /change y /bug arreglan lo que hace de MENOS — complementarios.",
  },
];

const FLOW_BY_SLUG: Record<string, SkillFlow> = Object.fromEntries(
  FLOWS.map((flow) => [flow.slug, flow]),
);

/** The curated flow for a skill, or undefined when none is authored yet. */
export function getSkillFlow(slug: string): SkillFlow | undefined {
  return FLOW_BY_SLUG[slug];
}

// The fictional ideas base (factory/ideas/*.md): 22 cards across the board columns, in the
// memo-pitch body format the app's pitch parser reads (verdict line, badges, "De un vistazo",
// scorecard table, "Profundizar" with risk/mitigation tables, red team, ask and evidence).
import { frontmatter } from "./common.mjs";

/** Memo-pitch body; `full` adds the cold-section tables the funko and saga cards carry. */
function pitch(p) {
  const vision = p.vision
    ? `### La visión
${p.vision.map(([t, d]) => `- **${t}** — ${d}`).join("\n")}
${p.preview ? `\n**Vista previa — ${p.preview.url}**\n${p.preview.checks.map((c) => `- ${c}`).join("\n")}\n` : ""}`
    : "";
  const deep = (p.deep ?? []).map(([h, body]) => `### ${h}\n${body}`).join("\n\n");
  return `> **Veredicto: ${p.verdict}** — **La apuesta:** ${p.oneLiner}
> **Badges:** ${p.badges.join(" | ")}

## 🔥 De un vistazo

### La apuesta
${p.bet}

### El problema
${p.problem}

> “${p.quote}”

### Por qué ahora
${p.whyNow}

${p.whyYou ? `### Por qué tú\n${p.whyYou}\n` : ""}
${vision}
| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | ${p.score.join(" | ")} |

## ❄️ Profundizar

${deep}`;
}

const FUNKO_DEEP = [
  ["Mercado", "Los coleccionistas de figuras de vinilo compran varias piezas al mes y se organizan en grupos de mensajería por franquicia. Ninguna herramienta une catálogo, colección y lista para compartir."],
  ["Distribución", "Las listas exportadas llevan el nombre de la app y circulan en los mismos grupos donde está la audiencia; un canal de contenido de coleccionismo amplifica los lanzamientos."],
  ["Catálogo y ficha", "Cada figura se identifica por serie y número de caja; las variantes (chase, brillo, exclusivas de tienda) son insignias de la misma ficha, no fichas nuevas."],
  ["Exportación de listas", `| Modo | Contenido | Presentación |
|---|---|---|
| **Toda la colección** | todas las figuras del alcance elegido | las que tienes resaltadas |
| **Solo las que tengo** | figuras marcadas como propias | ordenadas por serie |
| **Solo las que faltan** | figuras sin marcar | listas para pedir en el grupo |`],
  ["Gaps y fuente de la verdad", `| Riesgo | Mitigación |
|---|---|
| **Catálogo incompleto** — faltan exclusivas y reediciones | **Carga revisada** por un curador y vigilante horario de novedades |
| **Variantes ambiguas** — dos fichas para la misma pieza | **Una ficha por figura** con variantes como insignias |
| **Póster ilegible** — listas de cientos de figuras | **Partir en páginas** y probar con 300 figuras antes de lanzar |`],
  ["Riesgo legal", "Las imágenes oficiales se enlazan o se muestran con su licencia y su fuente; sin licencia, la ficha usa una ilustración neutra. Bajo con aviso."],
  ["Red team", "El riesgo de fondo es que el catálogo no esté a la altura: si un coleccionista no encuentra su figura dos veces, no vuelve. Por eso la carga inicial va antes que cualquier pantalla nueva."],
  ["El ask", "Aprobar el v1 con ocho FRDs y una carga inicial de tres franquicias revisadas a mano."],
  ["Evidencia", "- Entrevistas con ocho coleccionistas (notas internas).\n- Revisión de cinco apps y bases de datos públicas.\n- https://example.com/estudio-coleccionistas"],
];

const SAGA_DEEP = [
  ["Mercado", "Lectores de sagas largas que leen por temporadas y siguen la misma historia en libro y en serie."],
  ["Distribución", "Comunidades de relectura y clubes de lectura; cada resumen compartido es una invitación."],
  ["Gaps y fuente de la verdad", `| Riesgo | Mitigación |
|---|---|
| **Un spoiler se cuela** — un dato sin capítulo | **Verificador de límites** en la ingesta y en la integración continua |
| **Pocas obras al lanzar** — catálogo pequeño | **Cinco obras completas** antes de abrir |`],
  ["Riesgo legal", "Los resúmenes son textos propios; las imágenes llevan crédito o se reemplazan por ilustraciones."],
  ["Red team", "Si preparar una obra toma semanas, el catálogo no crece; la herramienta de ingesta es parte del producto, no un extra."],
  ["El ask", "Aprobar el v1 con la herramienta de ingesta incluida."],
  ["Evidencia", "- Foros de relectura con hilos de \"recordar sin spoilers\".\n- https://example.com/notas-lectores"],
];

const SHORT_DEEP = (market, risk, mitigation, ask) => [
  ["Mercado", market],
  ["Gaps y fuente de la verdad", `| Riesgo | Mitigación |\n|---|---|\n| **${risk}** | **${mitigation}** |`],
  ["Red team", "La duda principal es si el dolor es lo bastante frecuente para volver cada semana."],
  ["El ask", ask],
];

const IDEAS = [
  {
    slug: "funko-tracker", title: "Funko Tracker — catálogo y listas de tu colección de figuras", project_type: "web", status: "in-pipeline", verdict: "validate", return_type: "mixed", score: 77, favorite: true, created: "2026-06-10T00:00:00.000Z", project: "../projects/funko-tracker",
    body: pitch({
      verdict: "🧪 validate", oneLiner: "Encuentra cualquier figura en segundos, marca las que tienes y comparte lo que te falta en una sola imagen.",
      badges: ["🧪 validate", "cubeta: PEQUEÑA·1-2 sem", "vitamin", "retorno: oportunidad+personal"],
      bet: "Convertir el catálogo desordenado de un hobby en la herramienta que los coleccionistas abren dentro de la tienda.",
      problem: "Las variantes de una misma figura se parecen tanto que comprar duplicados es normal. Las listas viven en notas del teléfono y se comparten como capturas.",
      quote: "Busco a un personaje y me salen cinco versiones casi iguales; nunca sé cuál tengo.",
      whyNow: "Las exportaciones como imagen ya son el formato que circula en los grupos de coleccionistas; falta una fuente ordenada que las genere.",
      whyYou: "Conoces el hobby desde dentro y tienes acceso directo a una comunidad que prueba cada versión.",
      vision: [["Explorar", "franquicias, series y figuras con búsqueda y filtros."], ["Mi colección", "marcar \"la tengo\" desde cualquier tarjeta, sin configurar nada."], ["Metas", "series por completar y la lista de faltantes."], ["Lista para compartir", "una imagen legible para el grupo, con tres modos."]],
      preview: { url: "https://example.com/vista-previa-figuras", checks: ["✓ Una figura con tres variantes se ve como una sola ficha.", "✓ Las que tienes se distinguen en la lista exportada.", "! Una reedición sin fuente queda en revisión."] },
      score: ["Alto", "Medio; la exportación es la cuña", "small", "Media", "Personal + oportunidad"],
      deep: FUNKO_DEEP,
    }),
  },
  {
    slug: "book-memory-without-spoilers", title: "PandaSaga — recuerda tus historias sin spoilers y descubre sus conexiones", project_type: "ai", status: "in-pipeline", verdict: "validate", return_type: "personal", score: 72, favorite: true, created: "2026-06-10T00:00:00.000Z", project: "../projects/pandasaga",
    body: pitch({
      verdict: "🧪 validate", oneLiner: "Retoma cualquier historia donde la dejaste, con un resumen y una enciclopedia que solo saben hasta tu capítulo.",
      badges: ["🧪 validate", "cubeta: GRANDE", "vitamin", "retorno: personal"],
      bet: "Ser el compañero de lectura que sabe hasta dónde llegaste y nunca te arruina el final.",
      problem: "Volver a una saga después de semanas es confuso, y buscar un recordatorio en internet casi siempre trae el final.",
      quote: "Quería recordar quién era un personaje y en la primera búsqueda me enteré de que moría.",
      whyNow: "Los asistentes de IA hicieron normal preguntar por una historia; ninguno sabe hasta qué capítulo vas.",
      whyYou: "Lees por temporadas en varios formatos y sufres el problema cada mes.",
      vision: [["Resumen antes de retomar", "lo esencial hasta tu capítulo, en dos minutos."], ["Enciclopedia sin spoilers", "fichas que crecen contigo."], ["Mapa de conexiones", "quién se relaciona con quién, cuando se revela."], ["Varios formatos", "libro, serie y juego con su propio progreso."]],
      score: ["Alto", "Fuerte; nadie limita por capítulo", "large", "Media", "Personal"],
      deep: SAGA_DEEP,
    }),
  },
  {
    slug: "tiktok-crossposter", title: "PandaCast — publica un video una vez y llega a todas tus redes", project_type: "web", status: "in-pipeline", verdict: "validate", return_type: "mixed", score: 67, favorite: true, created: "2026-06-24T00:00:00.000Z", project: "../projects/pandacast",
    body: pitch({
      verdict: "🧪 validate", oneLiner: "Publica tu video corto en una red y PandaCast lo lleva al resto con el formato correcto.",
      badges: ["🧪 validate", "cubeta: PEQUEÑA·1-2 sem", "painkiller", "retorno: oportunidad+monetary"],
      bet: "Quitar el trabajo repetido que hace que los creadores pequeños abandonen redes.",
      problem: "Cada red pide su formato, su texto y su portada; subir el mismo video cinco veces se vuelve insostenible.",
      quote: "Dejé de publicar en dos redes porque no me daba la vida para subir todo otra vez.",
      whyNow: "Las redes abrieron APIs de publicación para cuentas de creador.",
      vision: [["Conectar redes", "en tres pasos y con su estado a la vista."], ["Detectar videos", "cada video nuevo en la red de origen."], ["Publicar con formato", "texto, portada y duración por red."], ["Panel", "qué se publicó dónde, y qué falló."]],
      score: ["Medio", "Medio", "small", "Alta", "Oportunidad + monetaria"],
      deep: SHORT_DEEP("Creadores independientes que publican varias veces por semana.", "Cambios en las APIs de las redes", "Un adaptador por red con pruebas de contrato", "Validar con cinco creadores durante dos semanas."),
    }),
  },
  {
    slug: "personal-page-v2", title: "PersonalPage v2 — portafolio personal que presenta a un desarrollador", project_type: "web", status: "shipped", verdict: "build", return_type: "mixed", score: 80, created: "2026-06-23T00:00:00.000Z", project: "../projects/personal-page-v2",
    body: pitch({
      verdict: "🏆 build", oneLiner: "Un portafolio que en diez segundos dice qué construyes, para quién y con qué resultados.",
      badges: ["🏆 build", "cubeta: PEQUEÑA·1-2 sem", "vitamin", "retorno: oportunidad"],
      bet: "Que cada contacto llegue sabiendo qué pedir.",
      problem: "El portafolio anterior era una lista de tecnologías sin contexto ni resultados.",
      quote: "Vi tu página y no supe qué hacías exactamente.",
      whyNow: "Hay tres casos recientes con resultados medibles que nadie conoce.",
      score: ["Alto", "Medio", "small", "Media", "Oportunidad"],
      deep: SHORT_DEEP("Responsables de contratación y clientes de proyectos cortos.", "Casos sin números", "Cada caso declara un resultado medible", "Lanzar con tres casos y dos entradas."),
    }),
  },
  { slug: "mission-control", title: "Pandacorp (Mission Control)", project_type: "web", status: "in-pipeline", verdict: "build", return_type: "personal", score: 0, created: "2026-06-10T00:00:00.000Z", project: "../projects/mission-control", body: "Panel local de la fábrica: tablero de ideas, portafolio y estado de cada proyecto, sin escribir nada salvo unos pocos campos de las tarjetas.\n" },
  {
    slug: "market-stall-ledger", title: "Cuaderno de Feria — inventario y ventas para puestos de mercado", project_type: "web", status: "discovered", verdict: "validate", return_type: "monetary", score: 74, created: "2026-06-25T00:00:00.000Z",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Anota ventas e inventario de tu puesto desde el teléfono, aun sin señal.", badges: ["🧪 validate", "cubeta: MICRO·2-3 días", "painkiller", "retorno: monetary"], bet: "Reemplazar el cuaderno de papel de los puestos de feria.", problem: "Los vendedores llevan sus ventas en papel y no saben qué producto deja más.", quote: "Al final del día no sé si gané o solo moví mercadería.", whyNow: "Los pagos con código QR ya son comunes en los mercados.", score: ["Medio", "Fuerte", "micro", "Alta", "Monetaria"], deep: SHORT_DEEP("Puestos de feria y mercados de fin de semana.", "Sin conexión en el mercado", "Funciona sin red y sincroniza al volver", "Probar con tres puestos durante un mes.") }),
  },
  {
    slug: "study-buddy-flashcards", title: "PandaLearn — tarjetas de estudio que se adaptan a tu ritmo", project_type: "web", status: "discovered", verdict: "validate", return_type: "mixed", score: 60, favorite: true, created: "2026-06-26T00:00:00.000Z",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Tarjetas de repaso que se programan solas según lo que olvidas.", badges: ["🧪 validate", "cubeta: PEQUEÑA·1-2 sem", "vitamin", "retorno: mixed"], bet: "Estudiar menos tiempo recordando más.", problem: "Las apps de repaso son potentes pero intimidan a quien empieza.", quote: "Instalé una app de tarjetas y la abandoné el segundo día.", whyNow: "Generar tarjetas desde apuntes ya es fácil y barato.", score: ["Medio", "Débil", "small", "Media", "Mixta"], deep: SHORT_DEEP("Estudiantes de idiomas y de exámenes de ingreso.", "Mercado saturado", "Empezar por un nicho de exámenes concretos", "Validar con un grupo de estudio.") }),
  },
  {
    slug: "script-to-storyboard", title: "PandaScript — del guion corto al storyboard en minutos", project_type: "ai", status: "discovered", verdict: "validate", return_type: "mixed", score: 70, created: "2026-06-27T00:00:00.000Z",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Pega el guion de un video corto y recibe un storyboard con tomas y textos.", badges: ["🧪 validate", "cubeta: PEQUEÑA·1-2 sem", "vitamin", "retorno: mixed"], bet: "Bajar el tiempo entre la idea y la grabación.", problem: "Planificar las tomas de un video corto toma más que grabarlo.", quote: "Tengo la idea clara pero me paralizo al pensar las tomas.", whyNow: "Los creadores ya escriben guiones con asistentes de IA.", score: ["Alto", "Medio", "small", "Media", "Mixta"], deep: SHORT_DEEP("Creadores de video corto que planifican su semana.", "Storyboards genéricos", "Plantillas por formato de video", "Probar con diez guiones reales.") }),
  },
  {
    slug: "spec-lint-assistant", title: "SpecLint — revisa especificaciones antes de construir", project_type: "claude-code", status: "discovered", verdict: "build", return_type: "monetary", score: 78, created: "2026-07-01T00:00:00.000Z",
    body: pitch({ verdict: "🏆 build", oneLiner: "Detecta criterios ambiguos y requisitos sin prueba en una especificación, antes de escribir código.", badges: ["🏆 build", "cubeta: MICRO·2-3 días", "painkiller", "retorno: monetary"], bet: "Que los equipos pequeños dejen de construir lo que nadie pidió.", problem: "Las especificaciones llegan con criterios que no se pueden probar.", quote: "Construimos dos semanas y el criterio decía \"rápido\".", whyNow: "Los equipos ya escriben especificaciones para agentes de código.", score: ["Alto", "Fuerte", "micro", "Media", "Monetaria"], deep: SHORT_DEEP("Equipos que trabajan con agentes de código.", "Falsos positivos", "Reglas explicables con ejemplo", "Probar en cinco repositorios abiertos.") }),
  },
  {
    slug: "quote-bot-small-shops", title: "CotizaBot — cotizaciones por mensajería para talleres", project_type: "automation", status: "discovered", verdict: "validate", return_type: "monetary", score: 70, created: "2026-07-08T00:00:00.000Z",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Un asistente que arma cotizaciones a partir de una foto y una descripción por mensajería.", badges: ["🧪 validate", "cubeta: PEQUEÑA·1-2 sem", "painkiller", "retorno: monetary"], bet: "Responder primero gana el trabajo.", problem: "Los talleres pierden clientes porque tardan días en cotizar.", quote: "Cuando respondo, el cliente ya fue a otro lado.", whyNow: "Los negocios pequeños ya atienden todo por mensajería.", score: ["Medio", "Medio", "small", "Alta", "Monetaria"], deep: SHORT_DEEP("Talleres y oficios con precios por trabajo.", "Precios mal calculados", "El taller aprueba cada cotización antes de enviarla", "Piloto con dos talleres.") }),
  },
  { slug: "client-report-builder", title: "Informe Express — reportes mensuales para clientes de agencias", project_type: "web", status: "discarded", return_type: "monetary", score: 0, created: "2026-06-24T00:00:00.000Z", status_before_discard: "discovered", body: "Generar el informe mensual de cada cliente a partir de sus métricas.\n" },
  { slug: "cloud-cost-watch", title: "CostoNube — alertas de gasto en la nube para equipos pequeños", project_type: "web", status: "discarded", return_type: "monetary", score: 0, created: "2026-06-24T00:00:00.000Z", status_before_discard: "discovered", body: "Avisar antes de que una factura de la nube se dispare.\n" },
  { slug: "creative-studio-crm", title: "EstudioCRM — clientes y proyectos para estudios creativos", project_type: "web", status: "discarded", return_type: "monetary", score: 0, created: "2026-06-25T00:00:00.000Z", status_before_discard: "discovered", discard_reason: "Mercado lleno de alternativas maduras y sin una cuña clara.", body: "Un CRM sencillo para estudios de diseño de dos a cinco personas.\n" },
  { slug: "table-order-qr", title: "MesaQR — pedidos desde la mesa con un código QR", project_type: "web", status: "discarded", return_type: "monetary", score: 0, created: "2026-06-26T00:00:00.000Z", status_before_discard: "discovered", discard_reason: "Requiere ventas presenciales a restaurantes; fuera de lo que se puede operar solo.", body: "Pedir y pagar desde la mesa sin esperar al mozo.\n" },
  { slug: "one-time-cv-maker", title: "CV de una vez — currículum sin suscripción", project_type: "web", status: "discarded", return_type: "monetary", score: 0, created: "2026-06-26T00:00:00.000Z", status_before_discard: "discovered", body: "Crear y descargar un currículum pagando una sola vez.\n" },
  { slug: "prompt-safety-scanner", title: "PromptGuard — revisa la seguridad de apps hechas con IA", project_type: "web", status: "discarded", return_type: "monetary", score: 0, created: "2026-06-27T00:00:00.000Z", status_before_discard: "discovered", body: "Buscar secretos expuestos y permisos excesivos en apps generadas con IA.\n" },
  {
    slug: "figure-authenticity-check", title: "AutentiFig — detecta figuras falsificadas con fotos", project_type: "web", status: "discarded", return_type: "mixed", score: 68, created: "2026-06-27T00:00:00.000Z", status_before_discard: "discovered", discard_reason: "La fuente de la verdad no existe: no hay base pública de piezas auténticas.",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Compara las fotos de una figura con referencias auténticas.", badges: ["🧪 validate", "cubeta: GRANDE", "painkiller", "retorno: mixed"], bet: "Comprar de segunda mano sin miedo.", problem: "Las falsificaciones son difíciles de distinguir en fotos.", quote: "Pagué de más por una figura que resultó falsa.", whyNow: "Crece la reventa entre coleccionistas.", score: ["Medio", "Débil", "large", "Media", "Mixta"], deep: SHORT_DEEP("Compradores de segunda mano.", "Sin referencias auténticas", "Ninguna mitigación barata", "Descartar hasta tener una fuente confiable.") }),
  },
  {
    slug: "collector-shop-front", title: "Vitrina — tienda online para coleccionistas que venden repetidos", project_type: "web", status: "discarded", return_type: "mixed", score: 72, created: "2026-06-28T00:00:00.000Z", status_before_discard: "discovered", discard_reason: "Mejor como extensión de Funko Tracker que como producto aparte.",
    body: pitch({ verdict: "🔌 integrate → funko-tracker", oneLiner: "Publica tus repetidos con la ficha del catálogo y véndelos en tu grupo.", badges: ["🔌 integrate", "cubeta: PEQUEÑA·1-2 sem", "vitamin", "retorno: mixed"], bet: "Cerrar el círculo de la colección.", problem: "Vender repetidos exige fotos y descripciones que nadie quiere escribir.", quote: "Tengo diez repetidos y me da flojera publicarlos.", whyNow: "La colección ya está catalogada en otra app.", score: ["Alto", "Medio", "small", "Media", "Mixta"], deep: SHORT_DEEP("Coleccionistas con piezas repetidas.", "Pagos y disputas", "Solo anuncios; la venta ocurre fuera", "Integrar en el v2 de la app de colección.") }),
  },
  {
    slug: "panda-collector-hub", title: "PandaHub — red social para coleccionistas de figuras", project_type: "web", status: "discarded", return_type: "mixed", score: 77, created: "2026-06-28T00:00:00.000Z", status_before_discard: "discovered",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Perfiles, vitrinas y grupos para coleccionistas.", badges: ["🧪 validate", "cubeta: GRANDE", "candy", "retorno: mixed"], bet: "Llevar la comunidad a un lugar propio.", problem: "Las comunidades viven dispersas en grupos de mensajería.", quote: "Cada franquicia tiene su grupo y se pierden las conversaciones.", whyNow: "Las listas compartidas ya generan conversación.", score: ["Medio", "Débil", "large", "Baja", "Mixta"], deep: SHORT_DEEP("Comunidades de coleccionistas.", "Moderación", "Empezar sin contenido abierto", "No construir: la comunidad ya tiene dónde estar.") }),
  },
  {
    slug: "exam-prep-coach", title: "Ruta de Ingreso — plan de estudio para exámenes de admisión", project_type: "web", status: "discarded", return_type: "mixed", score: 74, created: "2026-06-28T00:00:00.000Z", status_before_discard: "discovered", discard_reason: "El contenido de calidad depende de profesores que no tenemos.",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Un plan semanal de estudio según tu examen y tu fecha.", badges: ["🧪 validate", "cubeta: PEQUEÑA·1-2 sem", "painkiller", "retorno: mixed"], bet: "Ordenar el estudio de quien se prepara solo.", problem: "Los postulantes no saben qué estudiar cada semana.", quote: "Estudio mucho pero sin orden.", whyNow: "Los exámenes publican sus temarios en línea.", score: ["Medio", "Medio", "small", "Alta", "Mixta"], deep: SHORT_DEEP("Postulantes que estudian sin academia.", "Contenido pobre", "Alianza con profesores", "Descartado por falta de contenido propio.") }),
  },
  {
    slug: "price-check-pantry", title: "Despensa Lista — compara precios de tu lista del súper", project_type: "web", status: "discarded", return_type: "mixed", score: 72, created: "2026-07-01T00:00:00.000Z", status_before_discard: "discovered",
    body: pitch({ verdict: "🧪 validate", oneLiner: "Escribe tu lista y ve dónde sale más barata.", badges: ["🧪 validate", "cubeta: PEQUEÑA·1-2 sem", "vitamin", "retorno: mixed"], bet: "Ahorrar sin recorrer tiendas.", problem: "Comparar precios a mano lleva horas.", quote: "Siempre pienso que en otro lado estaba más barato.", whyNow: "Los supermercados publican sus precios en línea.", score: ["Medio", "Débil", "small", "Alta", "Mixta"], deep: SHORT_DEEP("Familias que compran semanalmente.", "Precios desactualizados", "Actualización diaria", "Validar si hay datos estables.") }),
  },
  {
    slug: "pet-care-reminders", title: "Patitas — recordatorios de vacunas y cuidados de mascotas", project_type: "web", status: "discarded", return_type: "mixed", score: 0, created: "2026-10-12T00:00:00.000Z", status_before_discard: "discovered", body: "Recordar vacunas, desparasitaciones y citas del veterinario.\n",
  },
];

/** Write every idea card into `<ideasDir>/<slug>.md`. */
export function ideaFiles() {
  return IDEAS.map((idea) => ({
    file: `${idea.slug}.md`,
    content: `${frontmatter([
      ["title", idea.title],
      ["project_type", idea.project_type],
      ["origin", "owner"],
      ["status", idea.status],
      ["status_before_discard", idea.status_before_discard ?? ""],
      ["discard_reason", idea.discard_reason ?? ""],
      ["verdict", idea.verdict ?? "validate"],
      ["score", idea.score],
      ["return_type", idea.return_type],
      ["created", idea.created],
      ["project", idea.project ?? ""],
      ...(idea.favorite ? [["favorite", true]] : []),
    ])}

${idea.body}`,
  }));
}

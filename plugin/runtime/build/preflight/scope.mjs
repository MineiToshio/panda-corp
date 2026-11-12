// preflight/scope.mjs: scope and conflict checks (groups `scope` and `conflict`).
import { readCard } from "../card.mjs";
import { provisionalSize } from "../detect.mjs";
import { affectsFrds, ask, asArray, clip, mk, unique } from "./common.mjs";

const NO_DOUBT_RE = /^(?:ninguna?s?|none|n\/a|no hay|sin dudas?)[.\s]*$/i;

export function sizeOf({ signals, scope, card, frdDirs }) {
  const hasWos = scope.wos.length > 0;
  const named = card ? [card.frd, ...card.affected_frds].filter(Boolean) : [];
  const known = (name) => frdDirs.includes(name.toLowerCase()) || frdDirs.some((d) => d.startsWith(`${name.toLowerCase()}-`));
  const newFrd = card ? named.length === 0 || named.some((f) => !known(f)) : false;
  const points = card ? (card.has_dentro && card.dentro.length > 0 ? card.dentro.length : null) : null;
  return provisionalSize({
    firstImpl: signals.first_impl === true,
    wos: scope.wos.length,
    frds: scope.frds.length,
    points: hasWos ? scope.wos.length : points,
    newFrd: hasWos ? false : newFrd,
  });
}

export function scopeChecks({ card, scope, size, signals, versionScale }) {
  const frds = scope.frds;
  const checks = [];
  const realDoubts = asArray(card?.dudas).filter((d) => !NO_DOUBT_RE.test(String(d.text).trim()));
  checks.push(realDoubts.length > 0
    ? mk("scope", "scope.doubts", "ask", `La tarjeta trae ${realDoubts.length} duda(s) abiertas.`, ask(
      "scope.doubts",
      `La tarjeta ${card.slug} trae ${realDoubts.length} duda(s) abiertas: ${realDoubts.slice(0, 3).map((d) => `"${clip(d.text, 70)}"`).join("; ")}.`,
      "las dejo fuera: construyo lo claro y aparco lo que dependa de ellas",
      "exclude_doubtful_points", affectsFrds(frds), true))
    : mk("scope", "scope.doubts", "pass", "Sin dudas abiertas en la tarjeta."));

  const uncited = card?.has_dentro ? card.dentro.filter((i) => !i.cited) : [];
  checks.push(uncited.length > 0
    ? mk("scope", "scope.summary_citation", "ask", `${uncited.length} punto(s) de Dentro no citan tu mensaje.`, ask(
      "scope.summary_citation",
      `${uncited.length} punto(s) de Dentro no citan tu mensaje (vienen solo de un resumen): ${uncited.slice(0, 3).map((i) => `"${clip(i.text, 70)}"`).join("; ")}.`,
      "los paso a Fuera como \"por confirmar\" y no los construyo",
      "move_to_fuera_por_confirmar", affectsFrds(frds), true))
    : mk("scope", "scope.summary_citation", "pass", "Cada punto de Dentro cita tu mensaje."));

  checks.push(size === "giant"
    ? mk("scope", "scope.giant", "ask", `El alcance es gigante: ${frds.length} FRDs y ${scope.wos.length} tareas.`, ask(
      "scope.giant",
      `El alcance es gigante (${frds.length} FRDs, ${scope.wos.length} tareas${signals.first_impl ? ", primera implementación del proyecto" : ""}).`,
      "lo construyo en tandas de 2 FRDs y el resto queda en cola",
      "tranches_of_2_frds", { all: true }, true))
    : mk("scope", "scope.giant", "pass", `Tamaño provisional: ${size}.`));

  checks.push(versionScale === true
    ? mk("scope", "scope.version", "ask", "Lo pedido parece un paquete de versión.", ask(
      "scope.version",
      "Lo pedido parece un paquete de versión (producto nuevo o varias épicas), no un cambio.",
      "no lo construyo; te dejo la lista de tarjetas y planes pendientes",
      "do_not_build", { all: true }, true))
    : mk("scope", "scope.version", "pass", "No es un paquete de versión."));
  return checks;
}

// ----------------------------------------------------------------------------------------------- conflict checks

export async function conflictChecks({ project, ctx, row, scope, card, signals }) {
  const checks = [];
  const live = signals.lease === "live" && row !== 2;
  checks.push(live
    ? mk("conflict", "conflict.foreign_lease", "ask", "Hay otro build vivo en el proyecto.", ask(
      "conflict.foreign_lease",
      `Hay otro build en marcha en este proyecto${signals.lease_coordinator === "drive" ? " (lo lleva el relevo de Codex)" : ""}. ¿Construyo esto después?`,
      "queda en cola y no lo construyo ahora", "queue_for_later", { all: true }, true))
    : mk("conflict", "conflict.foreign_lease", "pass", "Ningún otro build vivo."));

  const pausedRun = signals.run_status && signals.run_status !== "finished";
  checks.push([3, 4, 5].includes(row) && pausedRun
    ? mk("conflict", "conflict.paused_plus_card", "ask", `Hay un build ${signals.run_status} y además pediste otro alcance.`, ask(
      "conflict.paused_plus_card",
      `Hay un build ${signals.run_status} en este proyecto y además pediste esto.`,
      "primero lo conversado; el build pausado se retoma después", "conversed_first", { all: true }, true))
    : mk("conflict", "conflict.paused_plus_card", "pass", "Sin build pausado que choque con lo pedido."));

  const wanted = new Set(scope.frds);
  const clashes = [];
  for (const half of asArray(signals.cards_half)) {
    if (half.slug === scope.card) continue;
    const other = await readCard(project, half.slug, {}, ctx).catch(() => null);
    const frds = other ? [other.frd, ...other.affected_frds].filter(Boolean) : [];
    const shared = frds.filter((f) => wanted.has(f));
    clashes.push({ slug: half.slug, shared });
  }
  checks.push(clashes.length > 0
    ? mk("conflict", "conflict.half_cards", "ask", "Hay tarjetas a medio construir en el proyecto.", ask(
      "conflict.half_cards",
      `Hay tarjetas a medio construir sin un build vivo: ${clashes.map((c) => c.slug).join(", ")}.`,
      "no las toco y construyo solo este alcance", "leave_half_cards",
      clashes.some((c) => c.shared.length > 0) ? affectsFrds(unique(clashes.flatMap((c) => c.shared))) : { all: true }, true))
    : mk("conflict", "conflict.half_cards", "pass", "Ninguna tarjeta a medio construir choca con este alcance."));
  return checks;
}

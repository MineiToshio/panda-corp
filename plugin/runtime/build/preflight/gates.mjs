// preflight/gates.mjs: foreseeable human gates, the scope's artifacts and the plain-language routing of the announcement.
import path from "node:path";
import { frontmatterList, parseYamlSubset, splitFrontmatter } from "../card.mjs";
import { builderCell, reviewCell } from "../routing.mjs";
import { describeCell } from "../summary.mjs";
import { readText, unique } from "./common.mjs";

const PATH_TOKEN_RE = /`([\w@.-]+(?:\/[\w@.-]+)+\.[A-Za-z0-9]+)`/g;

/** Gate kinds foreseeable from a card's text (keyword scan over Spanish and English wording). */
const GATE_PATTERNS = Object.freeze([
  { kind: "production", re: /(?:a|en) producci[oó]n|production deploy|desplieg|\bdeploy(?:ar)?\b|go[- ]live/i, line: "Producción: lo que llegue a `main` de un proyecto lanzado espera tu orden." },
  { kind: "money", re: /\bpagos?\b|cobr|factur|stripe|paypal|checkout|billing|reembols|gastar|comprar|dinero/i, line: "Dinero: cualquier gasto esperará tu OK." },
  { kind: "delete", re: /borrar|borrado|eliminar (?:datos|cuentas?|usuarios?|registros)|purgar|drop table|truncate|delete (?:all|data|user|account)|destructiv/i, line: "Borrado de datos: esperará tu OK." },
  { kind: "external", re: /enviar (?:un )?(?:correo|email|mail|mensaje)|(?:correo|email) a |newsletter|publicar|tuit|tweet|comunicaci[oó]n externa/i, line: "Comunicación externa: esperará tu OK." },
  { kind: "production_migration", re: /migraci[oó]n(?:es)? (?:en|de|a) producci[oó]n|production migration|migrate prod/i, line: "Migración de producción: esperará tu OK." },
]);

export function foreseenGates({ card, launched }) {
  const text = card ? `${card.title}\n${card.body}` : "";
  const hits = GATE_PATTERNS.filter((g) => g.re.test(text));
  const kinds = hits.map((g) => g.kind);
  const lines = hits.map((g) => g.line);
  if (launched && !kinds.includes("production")) { kinds.push("production"); lines.push(GATE_PATTERNS[0].line); }
  return { kinds, lines };
}

export function cardPathFiles(card) {
  return unique([...String(card?.body ?? "").matchAll(PATH_TOKEN_RE)].map((m) => m[1]));
}

export async function scopeArtifacts({ project, ctx, scope, allWos }) {
  const files = [];
  for (const id of scope.wos) {
    const wo = allWos.find((w) => w.id === id);
    if (!wo) continue;
    const raw = await readText(ctx.fs, path.join(project, wo.file));
    const parts = raw === null ? null : splitFrontmatter(raw);
    if (parts) files.push(...frontmatterList(parseYamlSubset(parts.fm).data.artifacts));
  }
  return unique(files);
}

export function availabilityOf(policyView, codexLoginOk) {
  return {
    claude: policyView?.claude_new_units === false ? "quota" : "ok",
    codex: codexLoginOk === false ? "unreachable" : policyView?.codex_new_units === false ? "quota" : "ok",
  };
}

export function plainRouting({ label, size, zone, availability, coordinator }) {
  const shape = coordinator === "codex" ? "R-B" : undefined;
  try {
    const builder = builderCell({ kind: "build", size }, { label, zone, quota: availability, shape });
    if (!builder.runtime) return { builders: builder.paused ? "esperando cupo" : `${describeCell(builder.deferred)} cuando haya cupo`, reviewers: "por decidir" };
    const review = reviewCell({ authors: [{ runtime: builder.runtime, model: builder.model, effort: builder.effort }], kind: size === "touch" ? "touch" : "frd", zone, availability, shape });
    let reviewers = "por decidir";
    if (review.parked) reviewers = "sin revisor disponible: la pieza se aparca";
    else if (review.used) reviewers = `${describeCell(review.used)}${review.degraded ? ` (degradada: ${review.degraded})` : ""}`;
    return { builders: describeCell(builder), reviewers };
  } catch {
    return { builders: "por decidir", reviewers: "por decidir" };
  }
}

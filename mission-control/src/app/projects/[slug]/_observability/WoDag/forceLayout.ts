/**
 * forceLayout — the deterministic 2D placement of FRD cluster boxes.
 *
 * Ported verbatim (algorithm + constants) from the approved prototype
 * `docs/design/prototype/dag-2d.generator.mjs` (the seeded force sim + the AABB
 * no-overlap pass). It is PURE and DETERMINISTIC: positions are seeded on a
 * circle by index, the iteration counts are fixed, and there is NO randomness —
 * the same input always yields byte-identical output. This is required because
 * the layout runs inside a React render (RSC read path) and must never jitter
 * across renders or between server and client.
 *
 * It positions only the cluster CENTERS; the caller turns centers into
 * top-left box origins + the final canvas bounds.
 */

/** A cluster box to be positioned: its size is fixed, its center is solved for. */
export interface ForceBox {
  /** FRD slug — stable identity (used for the super-graph links). */
  readonly frd: string;
  /** Box width in px (computed from the cluster's card grid). */
  readonly w: number;
  /** Box height in px (computed from the cluster's card grid). */
  readonly h: number;
  /** Solved center x (mutated by the sim). */
  x: number;
  /** Solved center y (mutated by the sim). */
  y: number;
}

/** An undirected FRD↔FRD relation, used as a spring in the force sim. */
export interface ForceLink {
  readonly a: string;
  readonly b: string;
}

// --- Force-sim constants (verbatim from the prototype generator) -------------
const SEED_RADIUS = 650;
const SIM_ITERATIONS = 900;
const IDEAL_LINK_LEN = 340;
const REPULSION = 200000;
const LINK_STIFFNESS = 0.02;
const CENTERING = 0.005;
/** AABB no-overlap pass: gap kept between any two boxes (boxes never touch). */
const GAP = 34;
const SEPARATION_PASSES = 600;

/**
 * Seed each box center on a circle by index (deterministic — no randomness).
 * Index order is the caller's cluster order, so the seed is stable.
 */
function seedOnCircle(boxes: ForceBox[]): void {
  const n = boxes.length;
  boxes.forEach((box, i) => {
    const angle = (i / n) * Math.PI * 2;
    box.x = Math.cos(angle) * SEED_RADIUS;
    box.y = Math.sin(angle) * SEED_RADIUS;
  });
}

/** One repulsion sweep: every pair pushes apart, scaled by the cooling factor. */
function applyRepulsion(boxes: ForceBox[], cool: number): void {
  const n = boxes.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const rep = (REPULSION / (d * d)) * cool;
      a.x -= (dx / d) * rep;
      a.y -= (dy / d) * rep;
      b.x += (dx / d) * rep;
      b.y += (dy / d) * rep;
    }
  }
}

/** One spring sweep: linked boxes relax toward the ideal link length. */
function applyLinks(boxes: Map<string, ForceBox>, links: readonly ForceLink[], cool: number): void {
  for (const link of links) {
    const a = boxes.get(link.a);
    const b = boxes.get(link.b);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const f = (d - IDEAL_LINK_LEN) * LINK_STIFFNESS * cool;
    a.x += (dx / d) * f;
    a.y += (dy / d) * f;
    b.x -= (dx / d) * f;
    b.y -= (dy / d) * f;
  }
}

/** Gentle pull toward the origin so the cloud doesn't drift away. */
function applyCentering(boxes: ForceBox[], cool: number): void {
  for (const box of boxes) {
    box.x -= box.x * CENTERING * cool;
    box.y -= box.y * CENTERING * cool;
  }
}

/**
 * If two boxes overlap (within GAP), shove them apart along the cheaper axis.
 * Returns true when it moved them.
 */
function resolvePair(a: ForceBox, b: ForceBox): boolean {
  const ox = a.w / 2 + b.w / 2 + GAP - Math.abs(a.x - b.x);
  const oy = a.h / 2 + b.h / 2 + GAP - Math.abs(a.y - b.y);
  if (ox <= 0 || oy <= 0) return false;
  if (ox < oy) {
    const s = ((a.x < b.x ? -1 : 1) * ox) / 2;
    a.x += s;
    b.x -= s;
  } else {
    const s = ((a.y < b.y ? -1 : 1) * oy) / 2;
    a.y += s;
    b.y -= s;
  }
  return true;
}

/** One AABB separation sweep over every pair; returns true if anything moved. */
function separationSweep(boxes: ForceBox[]): boolean {
  const n = boxes.length;
  let any = false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a && b && resolvePair(a, b)) any = true;
    }
  }
  return any;
}

/**
 * AABB separation pass: repeat the sweep until no two boxes are within GAP of
 * each other (or the pass budget runs out). Guarantees boxes never touch.
 */
function separateBoxes(boxes: ForceBox[]): void {
  for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
    if (!separationSweep(boxes)) break;
  }
}

/** Run the fixed-iteration force simulation (repulsion + springs + centering). */
function runSimulation(
  boxes: ForceBox[],
  byFrd: Map<string, ForceBox>,
  links: readonly ForceLink[],
): void {
  for (let it = 0; it < SIM_ITERATIONS; it++) {
    const cool = 1 - it / SIM_ITERATIONS;
    applyRepulsion(boxes, cool);
    applyLinks(byFrd, links, cool);
    applyCentering(boxes, cool);
  }
}

/**
 * Solve cluster-box centers deterministically: seed on a circle, run the fixed
 * force simulation (cooling linearly), then the AABB no-overlap pass. Mutates
 * each box's `x`/`y` in place.
 */
export function solveForceLayout(boxes: ForceBox[], links: readonly ForceLink[]): void {
  if (boxes.length === 0) return;
  seedOnCircle(boxes);
  const byFrd = new Map(boxes.map((b) => [b.frd, b]));
  runSimulation(boxes, byFrd, links);
  separateBoxes(boxes);
}

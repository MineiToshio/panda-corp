"use client";

/**
 * RoamingCast — the cast of one campaign phase room (CMP-02-campaign-pipeline).
 *
 * Faithful to party-pipeline.html's roam engine (startRoam, ~L277-311):
 *   - In the ACTIVE room the cast wanders: each member walks to a fresh target
 *     every ~0.9–2.5s (sometimes toward another member to "collaborate"), bobbing
 *     while walking and idling otherwise; the lead carries an accent halo and a
 *     short speech bubble pops when two members meet.
 *   - DONE rooms idle-bob in place (desynced). LOCKED rooms are static + dimmed.
 *
 * The 60 fps loop mutates the DOM imperatively (refs + style/class) so React stays
 * out of the animation frame. Honors prefers-reduced-motion (no roam, no bob — the
 * bob keyframes are also disabled in globals.css under the same media query).
 *
 * "use client": uses refs + requestAnimationFrame + matchMedia.
 *
 * Traceability: CMP-02-campaign-pipeline → REQ-02-010 (AC-02-010.1 liveliness).
 */

import { useEffect, useRef } from "react";
import { AgentSprite } from "@/components/modules/party/AgentSprite/AgentSprite";

type AgentRole = Parameters<typeof AgentSprite>[0]["agentRole"];

/** A single member of a phase's cast. `lead` carries the accent halo. */
export interface RoamingCastMember {
  role: AgentRole;
  label: string;
  lead: boolean;
}

interface RoamingCastProps {
  /** The phase's specialists (already filtered to valid sprite roles). */
  members: ReadonlyArray<RoamingCastMember>;
  /** Sprite home positions [left, top] inside the room, by cast index. */
  homes: ReadonlyArray<readonly [number, number]>;
  /** Room state: "current" roams, "done" idle-bobs, "locked" is static + dimmed. */
  state: "current" | "done" | "locked";
}

/** Short in-character lines popped when two members meet (prototype DIALOG). */
const DIALOG: Record<string, readonly string[]> = {
  researcher: ["fuente validada ✓", "competidor: $9/mes", "API gratis", "dolor real ✓"],
  "product-manager": ["criterio EARS ✓", "¿entra al MVP?", "REQ priorizado", "métrica clara"],
  designer: ["token aplicado", "mockup listo", "¿contraste AA?", "grid resuelto"],
  copywriter: ["microcopy ✓", "voz: cercana", "CTA más claro", "empty state listo"],
  architect: ["camino dorado", "ADR escrito", "Build Plan ✓", "modelo de datos"],
  implementer: ["WO en review", "tests verdes", "contrato listo", "self-test ✓"],
  reviewer: ["aprobado", "re-corrí tests", "2 notas", "integración ok"],
  analytics: ["evento listo", "sin PII ✓", "embudo ok", "activación medida"],
  "security-auditor": ["sin secretos", "OWASP ✓", "deps al día", "auth revisada"],
  devops: ["deploy a staging", "rollback listo", "CI verde", "infra ok"],
};

/** Per-sprite runtime state for the roam loop (kept off React — mutated each frame). */
interface SpriteRuntime {
  el: HTMLDivElement;
  bob: HTMLElement | null;
  say: HTMLElement | null;
  role: string;
  px: number;
  py: number;
  tx: number;
  ty: number;
  phase: "pause" | "walk";
  t0: number;
  dur: number;
  meet: SpriteRuntime | null;
  sayTimer: number;
}

const SPRITE_W = 56;
const ROAM_SPEED = 0.5; // px/frame — matches the prototype
// Roam bounds inside a 250×208 room (prototype pick(): x 16–178, y 74–114).
const X_MIN = 16;
const X_MAX = 178;
const Y_MIN = 74;
const Y_SPAN = 40;
const DEFAULT_HOME: readonly [number, number] = [97, 84];

export function RoamingCast({ members, homes, state }: RoamingCastProps): React.JSX.Element {
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (state !== "current") return;
    // jsdom/SSR have no matchMedia — skip the roam loop entirely there (no animation needed).
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = wrapperRefs.current.filter((el): el is HTMLDivElement => el != null);
    if (els.length === 0) return;

    const sprites: SpriteRuntime[] = els.map((el) => {
      const hx = Number(el.dataset.homeX ?? 0);
      const hy = Number(el.dataset.homeY ?? 0);
      return {
        el,
        bob: el.querySelector<HTMLElement>("[data-roam-bob]"),
        say: el.querySelector<HTMLElement>("[data-roam-say]"),
        role: el.dataset.role ?? "",
        px: hx,
        py: hy,
        tx: hx,
        ty: hy,
        phase: "pause",
        t0: performance.now(),
        dur: 600 + Math.random() * 1400,
        meet: null,
        sayTimer: 0,
      };
    });

    const pick = (s: SpriteRuntime): void => {
      if (sprites.length > 1 && Math.random() < 0.45) {
        const others = sprites.filter((o) => o !== s);
        const o = others[Math.floor(Math.random() * others.length)];
        if (o != null) {
          s.tx = Math.max(X_MIN, Math.min(X_MAX, o.px + (s.px < o.px ? -30 : 30)));
          s.ty = o.py;
          s.meet = o;
          return;
        }
      }
      s.tx = X_MIN + Math.random() * (X_MAX - X_MIN);
      s.ty = Y_MIN + Math.random() * Y_SPAN;
      s.meet = null;
    };

    const bubble = (s: SpriteRuntime): void => {
      const say = s.say;
      if (say == null) return;
      const lines = DIALOG[s.role] ?? ["…"];
      say.textContent = lines[Math.floor(Math.random() * lines.length)] ?? "…";
      say.classList.add("on");
      window.clearTimeout(s.sayTimer);
      s.sayTimer = window.setTimeout(() => say.classList.remove("on"), 2000);
    };

    // Sprite reached its target: settle, pause, and (if it was a meet) trade bubbles.
    const arrive = (s: SpriteRuntime, now: number): void => {
      s.px = s.tx;
      s.py = s.ty;
      s.phase = "pause";
      s.t0 = now;
      s.dur = 900 + Math.random() * 1500;
      s.bob?.classList.remove("walking");
      if (s.meet != null) {
        bubble(s);
        bubble(s.meet);
        s.meet = null;
      }
    };

    // One frame's worth of motion for a single sprite (extracted to keep loop simple).
    const advance = (s: SpriteRuntime, now: number): void => {
      if (s.phase === "walk") {
        const dx = s.tx - s.px;
        const dy = s.ty - s.py;
        const d = Math.hypot(dx, dy);
        if (d < 1.3) {
          arrive(s, now);
        } else {
          s.px += (dx / d) * ROAM_SPEED;
          s.py += (dy / d) * ROAM_SPEED;
        }
      } else if (now - s.t0 > s.dur) {
        pick(s);
        s.phase = "walk";
        s.bob?.classList.add("walking");
      }
      s.el.style.transform = `translate(${s.px}px, ${s.py}px)`;
      s.el.style.zIndex = String(Math.round(s.py) + 10);
    };

    let raf = 0;
    let running = true;
    const loop = (): void => {
      if (!running) return;
      const now = performance.now();
      for (const s of sprites) advance(s, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      for (const s of sprites) window.clearTimeout(s.sayTimer);
    };
  }, [state]);

  const hasBob = state !== "locked";

  return (
    <div data-testid="campaign-cast" style={{ position: "absolute", inset: 0, zIndex: 3 }}>
      {members.map((m, i) => {
        const home = homes[i] ?? homes[0] ?? DEFAULT_HOME;
        const lockedStyle =
          state === "locked"
            ? { filter: "grayscale(0.9) brightness(0.7)", opacity: 0.72 }
            : undefined;
        return (
          <div
            key={m.role}
            ref={(el) => {
              wrapperRefs.current[i] = el;
            }}
            data-testid="campaign-sprite"
            data-role={m.role}
            data-home-x={home[0]}
            data-home-y={home[1]}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: SPRITE_W,
              transform: `translate(${home[0]}px, ${home[1]}px)`,
              zIndex: Math.round(home[1]) + 3,
            }}
          >
            <div
              data-roam-bob={hasBob ? "" : undefined}
              className={hasBob ? "campaign-bob" : undefined}
              style={{
                position: "relative",
                ...(state === "done" ? { animationDelay: `${(-(i * 0.7)).toFixed(2)}s` } : {}),
              }}
            >
              {m.lead && state === "current" && (
                <span
                  aria-hidden="true"
                  data-testid="campaign-sprite-halo"
                  className="campaign-halo"
                />
              )}
              <AgentSprite
                agentRole={m.role}
                state="idle"
                woId={m.label}
                style={{ position: "relative", ...lockedStyle }}
              />
              {state === "current" && (
                <span aria-hidden="true" data-roam-say="" className="campaign-say" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

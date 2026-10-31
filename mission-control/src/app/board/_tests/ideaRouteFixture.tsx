import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { render } from "@testing-library/react";
import PersistentBoard from "@/app/board/[...segments]/page";

/**
 * Reviewer harness: a real factory root on disk behind the real idea route. Nothing FRD-02 owns
 * is mocked, so readers, identities, Server Actions and digests meet the way they do in production.
 */
function factoryRoot(): string {
  const root = process.env.PANDACORP_FACTORY_ROOT;
  if (!root) throw new Error("PANDACORP_FACTORY_ROOT must point at the test factory");
  return root;
}

/** Empty the test factory so every test starts from its own cards and project. */
export function resetFactory(): void {
  const root = factoryRoot();
  rmSync(join(root, "factory"), { recursive: true, force: true });
  rmSync(join(root, "demo"), { recursive: true, force: true });
  mkdirSync(join(root, "factory", "ideas"), { recursive: true });
}

/** Write a file below the test factory, creating its folders. */
export function put(relative: string, body: string): string {
  const file = join(factoryRoot(), relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  return file;
}

/** Write one idea card and return its path. */
export function idea(slug: string, frontmatter: string, body = "Pitch del cuerpo."): string {
  return put(`factory/ideas/${slug}.md`, `---\n${frontmatter}\n---\n${body}\n`);
}

/** Write a linked project with every source a fully documented idea exposes. */
export function project(phase = "implementation", options: { digests?: boolean } = {}): void {
  const { digests = true } = options;
  put("demo/.pandacorp/status.yaml", `project: Demo Publica\nphase: ${phase}\nrunning: false\n`);
  put(
    "demo/docs/product/prd.md",
    "# PRD\n\n[Investigación](research.md)\n[Sin destino](nada.md)\n",
  );
  put("demo/docs/product/research.md", "# Research body\n");
  put("demo/docs/frds/frd-01-live/frd.md", "---\nid: FRD-01\ntitle: Live\nui: true\n---\n# Live\n");
  put("demo/docs/frds/frd-01-live/blueprint.md", "# Blueprint\n\nUna línea del blueprint.\n");
  put(
    "demo/docs/frds/frd-01-live/work-orders/wo-01-001-read.md",
    "---\nid: WO-01-001\ntitle: Orden viva\nimplementation_status: IN_REVIEW\n---\n# Orden\n",
  );
  if (!digests) return;
  put(
    "demo/.pandacorp/comms/spec-resumen.md",
    "## FRDs\n### FRD-01 · Título rancio\nEl lector vivo gana.\n",
  );
  put(
    "demo/.pandacorp/comms/arquitectura-resumen.md",
    "## Stack\n| Capa | Elección | Por qué |\n|---|---|---|\n| UI | Next | RSC |\n",
  );
}

/** Mount the real route for a URL below /board. */
export async function mountIdea(
  path: string,
  query: Record<string, string> = {},
): Promise<ReturnType<typeof render>> {
  const search = new URLSearchParams(query).toString();
  window.history.replaceState(null, "", `/board/${path}${search ? `?${search}` : ""}`);
  return render(
    await PersistentBoard({
      params: Promise.resolve({ segments: path.split("/").map(decodeURIComponent) }),
      searchParams: Promise.resolve(query),
    }),
  );
}

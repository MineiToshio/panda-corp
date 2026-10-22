import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { readArchitectureArtifacts } from "@/lib/architecture/read-artifacts";
import { parseArchitecture } from "@/lib/architecture/architecture";
import { readSpecDigest } from "@/lib/spec/read-spec";
import { parseSpec } from "@/lib/spec/spec";
import { readIdeas } from "@/lib/ideas/ideas";
import { readStatus } from "@/lib/status/status";
import { listProjectDocs, readDoc } from "@/lib/docs/tree";
import { readActivityLog, readDecisions } from "@/lib/docs/activity";
import { listWorkOrders, readWorkOrderDoc } from "@/lib/work-orders/work-orders";
import { readChangeQueue } from "@/lib/changes/changes";
import { readBuildTimeline } from "@/lib/build-track/build-track";
import { workspaceCommands } from "@/lib/next-step/next-step";
import { readManualPages } from "@/lib/manual/manual";
import { readServicesDirectory } from "@/lib/services/services";
import { getOverlayFreshness } from "@/lib/overlay-freshness/overlay-freshness";
import { parsePitch, parseRiskMitigation } from "@/lib/pitch/pitch";
import { PHASES as CAMPAIGN_PHASES } from "@/components/modules/CampaignPipeline/phases";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MISSION_CONTROL_ROOT = path.resolve(SCRIPT_DIR, "../../../../..");
const FACTORY_ROOT = path.dirname(MISSION_CONTROL_ROOT);
const OUTPUT_DIR = path.join(SCRIPT_DIR, "..", "data");

const PROJECTS = [
  { id: "mission-control", path: MISSION_CONTROL_ROOT, fallbackName: "Mission Control" },
  { id: "pandasaga", path: path.resolve(FACTORY_ROOT, "..", "pandasaga"), fallbackName: "PandaSaga" },
  { id: "funko-tracker", path: path.resolve(FACTORY_ROOT, "..", "funko-tracker"), fallbackName: "Funko Tracker" },
  { id: "pandacast", path: path.resolve(FACTORY_ROOT, "..", "pandacast"), fallbackName: "PandaCast" },
  { id: "personal-page-v2", path: path.resolve(FACTORY_ROOT, "..", "personal-page-v2"), fallbackName: "Personal Page v2" },
];

function internalDocLink({ href, children, ...props }) {
  if (typeof href === "string" && !/^(?:[a-z]+:|#|\/\/)/i.test(href)) {
    const relPath = href.replace(/^\.\//, "").split("#", 1)[0];
    return React.createElement(
      "a",
      { ...props, href: `#doc:${encodeURIComponent(relPath)}`, "data-doc-rel-path": relPath },
      children,
    );
  }
  return React.createElement("a", { ...props, href }, children);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarkdown(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) return "";
  const frontmatter = markdown.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const body = frontmatter == null ? markdown : markdown.slice(frontmatter[0].length);
  const metadata =
    frontmatter?.[1] == null
      ? ""
      : `<details class="document-meta"><summary>Metadatos del documento</summary><pre>${escapeHtml(frontmatter[1])}</pre></details>`;
  const renderedBody = renderToStaticMarkup(
    React.createElement(
      Markdown,
      {
        remarkPlugins: [remarkGfm],
        skipHtml: true,
        components: { a: internalDocLink },
      },
      body,
    ),
  );
  return `${metadata}${renderedBody}`;
}

function withRenderedSpecBlocks(parsed) {
  if (parsed == null) return null;
  const renderSection = (section) =>
    section == null
      ? null
      : {
          ...section,
          blocks: section.blocks.map((block) => ({
            ...block,
            html: renderMarkdown(block.markdown),
          })),
        };
  return {
    ...parsed,
    prd: renderSection(parsed.prd),
    research: renderSection(parsed.research),
  };
}

function normalisePath(value) {
  return path.resolve(value).replace(/\/$/, "");
}

function resolveIdeaProjectId(idea) {
  if (typeof idea.project !== "string" || idea.project.trim() === "") return null;
  const projectPointer = idea.project.trim();
  const pointerBase = path.basename(projectPointer.replace(/\/$/, ""));
  const match = PROJECTS.find(
    (project) =>
      projectPointer === project.id ||
      pointerBase === project.id ||
      normalisePath(projectPointer) === normalisePath(project.path),
  );
  return match?.id ?? null;
}

// The board's "Propuesta" tab structure, through the app's own pitch parser plus the same row rules
// the IdeaPitch component applies (problem quote, vision features/checks, red team, ask, risk pairs,
// legal, evidence). Markdown is pre-rendered so the study shows exactly the same content.
const FEATURE_RE = /^[-*]\s+\*\*(.+?)\*\*\s*[—:–-]*\s*(.*)$/;
const CHECK_RE = /^[-*]\s+(✓|✔|☑|✅|!|⚠|✗|✕)\s+(.*)$/;
const PREVIEW_RE = /vista previa|preview/i;
const withoutTables = (md) => md.split("\n").filter((l) => !l.trimStart().startsWith("|")).join("\n").trim();
function pitchSnapshot(body) {
  const pitch = parsePitch(body ?? "");
  if (!pitch.hasStructured) return null;
  const glance = pitch.glance.map((item) => {
    const base = { label: item.label, kind: item.kind, html: renderMarkdown(item.value) };
    if (item.kind === "problema") {
      const lines = item.value.split("\n");
      const prose = lines.filter((l) => !l.trimStart().startsWith(">")).join("\n").trim();
      const quote = lines.filter((l) => l.trimStart().startsWith(">")).map((l) => l.replace(/^\s*>\s?/, "")).join("\n").trim();
      return { ...base, proseHtml: renderMarkdown(prose), quoteHtml: quote ? renderMarkdown(quote) : "" };
    }
    if (item.kind === "vision") {
      const lines = item.value.split("\n");
      const features = lines.map((l) => l.match(FEATURE_RE)).filter(Boolean).map((m) => ({ title: m[1].trim(), desc: (m[2] ?? "").trim() }));
      const checks = lines.map((l) => l.match(CHECK_RE)).filter(Boolean).map((m) => ({ ok: /[✓✔☑✅]/.test(m[1]), text: m[2].trim() }));
      const preview = lines.find((l) => PREVIEW_RE.test(l));
      return { ...base, features, checks, previewUrl: preview ? preview.replace(/\*\*/g, "").replace(/^[-*>\s]+/, "").trim() : null };
    }
    return base;
  });
  const deep = pitch.deepDive.map((section) => {
    const risks = parseRiskMitigation(section.markdown);
    const kind = /evidencia|evidence|fuentes/i.test(section.heading) ? "evidence" : /red team|pre.?mortem/i.test(section.heading) ? "premortem" : /\bask\b/i.test(section.heading) ? "ask" : risks.length ? "risks" : /legal/i.test(section.heading) ? "legal" : "default";
    return {
      heading: section.heading,
      kind,
      html: renderMarkdown(kind === "risks" ? withoutTables(section.markdown) : section.markdown),
      risks: risks.map((r) => ({ riskHtml: renderMarkdown(r.risk), mitigationHtml: renderMarkdown(r.mitigation) })),
    };
  });
  return { verdict: pitch.verdict, laApuesta: pitch.laApuesta ? renderMarkdown(pitch.laApuesta) : null, badges: pitch.badges, glance, scorecard: pitch.scorecard, deep };
}

function ideaSnapshot(idea) {
  return {
    slug: idea.slug,
    title: idea.title,
    category: idea.projectType ?? null,
    return: idea.returnType ?? null,
    score: idea.score ?? null,
    status: idea.status,
    favorite: idea.favorite === true,
    body: idea.body,
    html: renderMarkdown(idea.body),
    pitch: pitchSnapshot(idea.body),
    projectId: resolveIdeaProjectId(idea),
  };
}

function isRegularFile(filePath) {
  try {
    return fs.lstatSync(filePath).isFile();
  } catch {
    return false;
  }
}

function listMarkdownFiles(root, base = root) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "coverage"].includes(entry.name)) continue;
      files.push(...listMarkdownFiles(absolutePath, base));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(path.relative(base, absolutePath).split(path.sep).join("/"));
    }
  }
  return files;
}

function docGroup(relPath, canonicalGroup) {
  if (canonicalGroup) return canonicalGroup;
  if (/^docs\/frds\/[^/]+\/work-orders\//.test(relPath)) return "Work orders";
  if (relPath === "DESIGN.md" || relPath.startsWith("docs/design/")) return "Design";
  if (relPath.startsWith("docs/product/")) return "Product";
  const frd = relPath.match(/^docs\/frds\/([^/]+)\//);
  if (frd?.[1]) return `Feature: ${frd[1]}`;
  if (relPath.startsWith("docs/adr/")) return "Global: ADRs";
  if (relPath.startsWith("docs/analytics/")) return "Analytics";
  if (relPath.startsWith("docs/reviews/")) return "Reviews";
  if (relPath.startsWith("docs/rules/")) return "Rules";
  return "Global";
}

function readAllProjectDocs(projectPath) {
  const canonicalNodes = listProjectDocs(projectPath);
  const canonicalByPath = new Map(canonicalNodes.map((node) => [node.relPath, node]));
  const relPaths = listMarkdownFiles(path.join(projectPath, "docs"), projectPath);
  const designPath = path.join(projectPath, "DESIGN.md");
  if (isRegularFile(designPath)) relPaths.push("DESIGN.md");

  return [...new Set(relPaths)].sort().flatMap((relPath) => {
    const canonical = canonicalByPath.get(relPath);
    let body = canonical ? readDoc(projectPath, relPath) : null;
    if (body == null) {
      const absolutePath = path.resolve(projectPath, relPath);
      const docsRoot = path.resolve(projectPath, "docs") + path.sep;
      const isAllowed = relPath === "DESIGN.md" || absolutePath.startsWith(docsRoot);
      if (!isAllowed || !isRegularFile(absolutePath)) return [];
      try {
        body = fs.readFileSync(absolutePath, "utf8");
      } catch {
        return [];
      }
    }
    return [
      {
        id: canonical?.id ?? relPath.replace(/\.[^/.]+$/, ""),
        relPath,
        label: canonical?.label ?? path.basename(relPath),
        group: docGroup(relPath, canonical?.group),
        body,
        html: renderMarkdown(body),
      },
    ];
  });
}

function firstUsefulParagraph(markdown) {
  if (!markdown) return null;
  const text = markdown
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .split(/\n\s*\n/)
    .map((part) =>
      part
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/[*_`[\]]/g, "")
        .replace(/\([^)]*\)/g, "")
        .trim(),
    )
    .find((part) => part.length > 20 && !part.startsWith("|"));
  return text ?? null;
}

// The services directory joins the public catalog with the private accounts file. Like the app's
// Accounts view, the snapshot keeps the login email and dashboard link (so the owner knows which
// account to sign in with); it drops credentials, notes, native resource ids and quota snapshots.
const SERVICES = readServicesDirectory({ factoryRoot: FACTORY_ROOT });
function projectServices(projectId) {
  return SERVICES.allocations
    .filter((allocation) => allocation.projectId === projectId)
    .map((allocation) => {
      const provider = SERVICES.providers.find((entry) => entry.id === allocation.providerId);
      const account = SERVICES.accounts.find((entry) => entry.id === allocation.accountRef);
      return {
        id: allocation.integrationId,
        providerId: allocation.providerId,
        provider: provider?.name ?? allocation.providerId,
        type: provider?.type ?? null,
        purpose: provider?.purpose ?? null,
        status: allocation.status,
        account: account ? { name: account.displayName, login: account.loginEmail ?? null, access: account.accessStatus, automation: account.automationStatus, plan: account.plan } : null,
        url: account?.dashboardUrl ?? provider?.dashboardUrl ?? null,
        environments: allocation.resources.map((resource) => ({ environment: resource.environment, resource: resource.resourceName })),
      };
    });
}

function buildProject(project, ideas) {
  const statusResult = readStatus(project.path);
  const status = statusResult.present ? statusResult.status : null;
  const idea = ideas.find((candidate) => candidate.projectId === project.id) ?? null;

  const specRaw = readSpecDigest(project.path);
  const spec =
    specRaw == null
      ? null
      : { raw: specRaw, html: renderMarkdown(specRaw), parsed: withRenderedSpecBlocks(parseSpec(specRaw)) };

  const artifacts = readArchitectureArtifacts(project.path);
  const architectureRaw = artifacts.architectureContent ?? null;
  const architecture =
    architectureRaw == null
      ? null
      : {
          raw: architectureRaw,
          html: renderMarkdown(architectureRaw),
          parsed: parseArchitecture(architectureRaw),
        };

  const orders = listWorkOrders(project.path).map((order) => {
    const body = readWorkOrderDoc(project.path, order.relPath);
    return { ...order, body, html: body == null ? null : renderMarkdown(body) };
  });
  const docs = readAllProjectDocs(project.path);
  const adrs = (artifacts.adrs ?? []).map((adr) => ({ ...adr, html: renderMarkdown(adr.body) }));
  const changeQueue = readChangeQueue(project.path);
  const changes = {
    items: changeQueue.items.map((change) => ({ ...change, html: renderMarkdown(change.body) })),
    errors: changeQueue.errors,
  };
  const timeline = readBuildTimeline(project.path, orders);
  const decisions = readDecisions(project.path);
  const activity = readActivityLog(project.path);
  const commands = workspaceCommands(status?.phase);
  const frdGroups = new Set(
    docs.filter((doc) => doc.group.startsWith("Feature:")).map((doc) => doc.group),
  );

  const phase = status?.phase ?? null;
  const version = status?.version ?? null;
  const name = idea?.title ?? status?.project ?? project.fallbackName;
  const subtitle =
    spec?.parsed.intro ?? architecture?.parsed.intro ?? firstUsefulParagraph(idea?.body) ?? null;

  return {
    id: project.id,
    name,
    subtitle,
    phase,
    running: status?.running ?? null,
    version,
    overlay: getOverlayFreshness(status?.overlayVersion ?? null, FACTORY_ROOT),
    idea,
    spec,
    architecture,
    model: artifacts.dataModel,
    orders,
    docs,
    adrs,
    changes,
    timeline,
    decisions,
    activity,
    commands,
    envNames: (artifacts.envVars ?? []).map((envVar) => envVar.name),
    // Names and comments only, exactly what the app shows; values are never read.
    envVars: (artifacts.envVars ?? []).map((envVar) => ({ name: envVar.name, comment: envVar.comment ?? "" })),
    services: projectServices(project.id),
    targetPlatforms: status?.targetPlatforms ?? status?.target_platforms ?? null,
    deployTarget: status?.deployTarget ?? status?.deploy_target ?? null,
    counts: {
      orders: orders.length,
      done: orders.filter((order) => order.state === "done").length,
      docs: docs.length,
      frds: frdGroups.size,
    },
  };
}

const ideas = readIdeas(path.join(FACTORY_ROOT, "factory", "ideas")).map(ideaSnapshot);
const projects = PROJECTS.map((project) => buildProject(project, ideas));
const manual = readManualPages(MISSION_CONTROL_ROOT).map((page) => ({
  ...page,
  html: renderMarkdown(page.body),
}));
const capturedAt = new Date().toISOString();
const snapshot = { capturedAt, ideas, projects, manual, campaign: CAMPAIGN_PHASES };

const gaps = projects.flatMap((project) => {
  const missing = [];
  if (project.idea == null) missing.push("idea");
  if (project.spec == null) missing.push("spec");
  if (project.architecture == null) missing.push("architecture");
  if (project.model.kind === "missing") missing.push("data-model");
  return missing.length === 0 ? [] : [{ projectId: project.id, missing }];
});

const manifest = {
  capturedAt,
  generator: "scripts/export-snapshot.mjs",
  command:
    "node --loader ./scripts/read-model/ts-loader.mjs docs/design/explorations/visual-refresh-2026/scripts/export-snapshot.mjs",
  provenance: {
    ideas: "factory/ideas/*.md via readIdeas",
    status: ".pandacorp/status.yaml via readStatus",
    spec: ".pandacorp/comms/spec-resumen.md via readSpecDigest + parseSpec",
    architecture:
      ".pandacorp/comms/arquitectura-resumen.md and architecture artifacts via readArchitectureArtifacts + parseArchitecture",
    orders: "docs/frds/*/work-orders/wo-*.md via listWorkOrders + readWorkOrderDoc",
    docs: "docs/**/*.md and DESIGN.md; canonical subset via listProjectDocs + readDoc",
    changes: ".pandacorp/inbox/changes/**/*.md via readChangeQueue",
    timeline: ".pandacorp/track.jsonl, git history, or structural fallback via readBuildTimeline",
    decisions: ".pandacorp/inbox/decisions.md via readDecisions",
    activity: ".pandacorp/comms/progress.md via readActivityLog",
    commands: "project phase via workspaceCommands",
    manual: "mission-control/content/manual/**/*.{md,mdx} via readManualPages",
    markdown: "react-markdown + remark-gfm + react-dom/server; raw HTML disabled",
    environment: ".env.example names via readArchitectureArtifacts; values excluded",
  },
  counts: {
    ideas: ideas.length,
    projects: projects.length,
    orders: projects.reduce((total, project) => total + project.counts.orders, 0),
    done: projects.reduce((total, project) => total + project.counts.done, 0),
    docs: projects.reduce((total, project) => total + project.counts.docs, 0),
    frds: projects.reduce((total, project) => total + project.counts.frds, 0),
    adrs: projects.reduce((total, project) => total + project.adrs.length, 0),
    changes: projects.reduce((total, project) => total + project.changes.items.length, 0),
    decisions: projects.reduce((total, project) => total + project.decisions.length, 0),
    activityEntries: projects.reduce(
      (total, project) => total + project.activity.entries.length,
      0,
    ),
    manual: manual.length,
  },
  projects: projects.map((project) => ({
    id: project.id,
    idea: project.idea?.slug ?? null,
    counts: project.counts,
    adrs: project.adrs.length,
    changes: project.changes.items.length,
    changeErrors: project.changes.errors.length,
    decisions: project.decisions.length,
    activityEntries: project.activity.entries.length,
    timeline: project.timeline.source,
    commands: project.commands.length,
    envNames: project.envNames.length,
    hasSpec: project.spec != null,
    hasArchitecture: project.architecture != null,
    dataModel: project.model.kind,
  })),
  gaps,
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const json = JSON.stringify(snapshot).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
fs.writeFileSync(path.join(OUTPUT_DIR, "snapshot.js"), `window.MC_SNAPSHOT = ${json};\n`, "utf8");
fs.writeFileSync(
  path.join(OUTPUT_DIR, "snapshot-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(manifest.counts));

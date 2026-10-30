import { createElement, Fragment, type ReactNode } from "react";
import catalogue from "@/../docs/design/microcopy.es.json";

/** A plural entry of the catalogue, selected by `vars.count` through `Intl.PluralRules("es")`. */
interface PluralEntry {
  readonly one: string;
  readonly other: string;
}

type Catalogue = typeof catalogue;

type LeafPaths<T> = T extends string | PluralEntry
  ? never
  : {
      [K in keyof T & string]: T[K] extends string | PluralEntry ? K : `${K}.${LeafPaths<T[K]>}`;
    }[keyof T & string];

/** Every leaf key of the frozen catalogue (`docs/design/microcopy.es.json`); an unknown key fails `tsc`. */
export type CopyKey = LeafPaths<Catalogue>;

export type CopyVars = Readonly<Record<string, string | number>>;

const PLURALS = new Intl.PluralRules("es");
const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;
const INLINE_TAG = /<(b|code|i)>([\s\S]*?)<\/\1>/g;

function isPlural(value: unknown): value is PluralEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PluralEntry).one === "string" &&
    typeof (value as PluralEntry).other === "string"
  );
}

function lookup(key: string, vars: CopyVars | undefined): string {
  let node: unknown = catalogue;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      throw new Error(`copy: unknown key "${key}"`);
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === "string") return node;
  if (isPlural(node)) {
    const count = vars?.count;
    if (typeof count !== "number")
      throw new Error(`copy: plural key "${key}" needs a numeric "count"`);
    return PLURALS.select(count) === "one" ? node.one : node.other;
  }
  throw new Error(`copy: key "${key}" is a group, not a string`);
}

function fill(template: string, vars: CopyVars | undefined, key: string): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = vars?.[name];
    if (value === undefined) throw new Error(`copy: missing "${name}" for key "${key}"`);
    return String(value);
  });
}

/**
 * Interface string by key, with `{name}` placeholders filled from `vars`.
 * @throws when a placeholder has no value, a plural has no numeric `count`, or the key is unknown at runtime.
 */
export function t(key: CopyKey, vars?: CopyVars): string {
  return fill(lookup(key, vars), vars, key);
}

/**
 * Like `t`, for catalogue values carrying inline `<b>`, `<code>` and `<i>` tags: returns React nodes,
 * never HTML. Variables are inserted as text, so a value can not inject a tag.
 */
export function tRich(key: CopyKey, vars?: CopyVars): ReactNode {
  const template = lookup(key, vars);
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of template.matchAll(INLINE_TAG)) {
    const [whole, tag, inner] = match;
    if (match.index > last) parts.push(fill(template.slice(last, match.index), vars, key));
    parts.push(
      createElement(
        tag as string,
        { key: `${tag}-${match.index}` },
        fill(inner as string, vars, key),
      ),
    );
    last = match.index + whole.length;
  }
  if (last < template.length) parts.push(fill(template.slice(last), vars, key));
  if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
  return createElement(Fragment, null, ...parts);
}

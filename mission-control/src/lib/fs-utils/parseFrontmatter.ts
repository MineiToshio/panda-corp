import matter from "gray-matter";

function rejectExecutableFrontmatter(): never {
  throw new Error("Executable frontmatter is not supported");
}

const OPTIONS = {
  excerpt: false,
  engines: Object.fromEntries(
    ["js", "javascript", "coffee", "coffeescript", "cson"].map((language) => [
      language,
      { parse: rejectExecutableFrontmatter, stringify: rejectExecutableFrontmatter },
    ]),
  ),
};

/** Parse data-only frontmatter, bypassing gray-matter's content cache on every call. */
export function parseFrontmatter(input: string, _options?: { excerpt: false }) {
  return matter(input, OPTIONS);
}

/** Serialize data-only frontmatter through the same restricted engine boundary. */
export function stringifyFrontmatter(content: string, data: object): string {
  return matter.stringify(content, data, OPTIONS);
}

export default Object.assign(parseFrontmatter, { stringify: stringifyFrontmatter });

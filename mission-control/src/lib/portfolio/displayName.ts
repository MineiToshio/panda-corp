const SHORT_NAMES: Readonly<Record<string, string>> = {
  "Pandacorp (Mission Control)": "Mission Control",
};

/** Short project label for operational surfaces; the portfolio source name stays the identity. */
export function projectDisplayName(sourceName: string): string {
  return SHORT_NAMES[sourceName] ?? sourceName;
}

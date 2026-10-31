import type { ReactNode } from "react";

/** Browser-native link to an authored documentation page. */
export function ManualLink({
  group,
  slug,
  children,
}: {
  readonly group: string;
  readonly slug: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={`/manual/${encodeURIComponent(group)}/${encodeURIComponent(slug)}`}
      style={{ color: "var(--violet)", textDecoration: "underline" }}
    >
      {children}
    </a>
  );
}

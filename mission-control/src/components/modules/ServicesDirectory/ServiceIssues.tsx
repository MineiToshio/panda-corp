import { Notice } from "@/components/core/Notice/Notice";
import { t, tRich } from "@/lib/copy/copy";
import type { ServiceIssue } from "@/lib/services/types";
/** Bounded reasons and non-sensitive file labels only; never parser exception text. */
export function ServiceIssues({ issues }: { issues: ServiceIssue[] }): React.JSX.Element | null {
  if (!issues.length) return null;
  return (
    <Notice icon="alert" kind="error">
      <b>{t("workspace.cuentas.issues.title")}</b>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.source}:${issue.code}`}>
            {tRich("workspace.cuentas.issues.line", {
              source: issue.source,
              reason: t(`workspace.cuentas.issues.${issue.code}`),
            })}
          </li>
        ))}
      </ul>
      <p>{t("workspace.cuentas.issues.note")}</p>
    </Notice>
  );
}

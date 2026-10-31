import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";

/** Domain-named read failure; never exposes filesystem exception details in the interface. */
export function SourceError({ source }: { readonly source: string }): React.JSX.Element {
  return (
    <Notice icon="alert" kind="error">
      <strong>{source}</strong>: {t("workspace.cuentas.issues.unreadable")}
    </Notice>
  );
}

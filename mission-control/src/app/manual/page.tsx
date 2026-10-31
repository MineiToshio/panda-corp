import type { Metadata } from "next";
import { t } from "@/lib/copy/copy";
import { readManualPages } from "@/lib/manual/manual";
import { readServiceManualPages } from "@/lib/services/manual";
import { ManualShell } from "./ManualShell";

export const metadata: Metadata = {
  title: t("documentacion.title"),
  description: t("documentacion.subtitle"),
};

/** Read the authored index once; catalogs remain owned by Configuration. */
export default function ManualPage(): React.JSX.Element {
  const pages = [...readManualPages(), ...readServiceManualPages()];
  return (
    <div data-testid="manual-page">
      <ManualShell pages={pages} />
    </div>
  );
}

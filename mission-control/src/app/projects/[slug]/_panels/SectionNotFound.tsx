import { Card } from "@/components/core/Card/Card";
import { t } from "@/lib/copy/copy";
import { navigationHref } from "@/lib/navigation/urls";
import type { PanelProps } from "./types";

export function SectionNotFound({ route }: PanelProps): React.JSX.Element {
  return (
    <Card>
      <h2>{t("portafolio.notFoundSection.title")}</h2>
      <p>{t("portafolio.notFoundSection.detail", { tab: route.rawTab ?? "" })}</p>
      <a href={navigationHref(route.navigationBaseHref, { tab: "summary", raw: null })}>
        {t("portafolio.notFoundSection.link")}
      </a>
    </Card>
  );
}

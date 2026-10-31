"use client";
import { useParams, useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/core/Button/ButtonLink";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { t } from "@/lib/copy/copy";

export default function PortfolioNotFound(): React.JSX.Element {
  const params = useParams<{ segments?: string[] }>();
  const query = useSearchParams();
  const id = params.segments?.[0] ?? query.get("project");
  const view = query.get("view");
  return (
    <Card tone="coral">
      <CardHeader
        title={t(id ? "portafolio.notFoundProject.title" : "portafolio.notFoundSection.title")}
        icon="alert"
      />
      <EmptyState icon="search">
        {id
          ? t("portafolio.notFoundProject.detail", { id })
          : view
            ? t("portafolio.notFoundSection.detail", { tab: view })
            : t("portafolio.subtitle")}
      </EmptyState>
      <ButtonLink href="/portfolio" look="button">
        {t("portafolio.notFoundProject.link")}
      </ButtonLink>
    </Card>
  );
}

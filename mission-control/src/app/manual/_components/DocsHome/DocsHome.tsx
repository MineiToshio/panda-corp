import { Card, CardFoot, CardHeader } from "@/components/core/Card/Card";
import { Icon } from "@/components/core/Icon/Icon";
import { DividedList, ListRow } from "@/components/core/ListRow/ListRow";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { t } from "@/lib/copy/copy";
import type { ManualPage } from "@/lib/manual/manual";
import styles from "./DocsHome.module.css";
import { DAILY_GUIDES, DOC_GROUPS, ESSENTIALS, groupPages, pageHref } from "./model";

function curated(
  pages: readonly ManualPage[],
  group: string,
  slugs: readonly string[],
): ManualPage[] {
  return slugs.flatMap((slug) => {
    const page = pages.find((entry) => entry.group === group && entry.slug === slug);
    return page ? [page] : [];
  });
}

/** Documentation entry points and live, index-derived counts. */
export function DocsHome({ pages }: { readonly pages: readonly ManualPage[] }): React.JSX.Element {
  const tutorial = groupPages(pages, "tutorial");
  const guides = groupPages(pages, "guides");
  return (
    <div className={styles.stack} data-testid="docs-home">
      <div className={`docs-pair ${styles.pair}`}>
        <Card tone="pink">
          <CardHeader title={t("documentacion.startHere.title")} icon="sparkles" />
          <p className={styles.intro}>
            {t("documentacion.startHere.intro", { count: tutorial.length })}
          </p>
          <ol
            aria-label={t("documentacion.startHere.title")}
            className={`docs-steps ${styles.steps}`}
          >
            {tutorial.map((page, index) => (
              <li key={page.slug}>
                <a href={pageHref(page)}>
                  <span className={styles.number}>{index + 1}</span>
                  <span className={styles.stepBody}>
                    <b>{page.title}</b>
                    <small>
                      {page.body.split("\n").find((line) => line.trim() && !/^[#>]/.test(line))}
                    </small>
                  </span>
                  <Icon name="arrow" size="sm" />
                </a>
              </li>
            ))}
          </ol>
          <h3 className={`docs-sub ${styles.sub}`}>{t("documentacion.startHere.essentials")}</h3>
          <DividedList
            items={curated(pages, "concepts", ESSENTIALS).map((page) => ({
              id: page.slug,
              row: <ListRow title={page.title} href={pageHref(page)} icon="book" tone="blue" />,
            }))}
          />
        </Card>
        <Card tone="teal">
          <CardHeader title={t("documentacion.guides.title")} icon="flag" />
          <DividedList
            items={curated(pages, "guides", DAILY_GUIDES).map((page) => ({
              id: page.slug,
              row: <ListRow title={page.title} href={pageHref(page)} icon="flag" tone="teal" />,
            }))}
          />
          <CardFoot>
            <span>{t("documentacion.guides.count", { count: guides.length })}</span>
            <a href={guides[0] ? pageHref(guides[0]) : "/manual"}>
              {t("documentacion.guides.seeAll")}
            </a>
          </CardFoot>
        </Card>
      </div>
      <section>
        <SectionHead label={t("documentacion.explore.title")} />
        <div className={`docs-groups ${styles.groups}`}>
          {DOC_GROUPS.map((group) => {
            const entries = groupPages(pages, group.id);
            return (
              <a
                className={`docs-group ${styles.group}`}
                key={group.id}
                data-tone={group.tone}
                href={entries[0] ? pageHref(entries[0]) : "/manual"}
              >
                <b>{t(group.key)}</b>
                <span>{t(`documentacion.explore.groups.${group.id}.what`)}</span>
                <small>{t("documentacion.explore.pageCount", { count: entries.length })}</small>
              </a>
            );
          })}
          <a className={`docs-group ${styles.group}`} data-tone="slate" href="/configuration">
            <b>{t("documentacion.explore.reference.label")}</b>
            <span>{t("documentacion.explore.reference.what")}</span>
            <small>{t("documentacion.explore.reference.count")}</small>
          </a>
        </div>
      </section>
    </div>
  );
}

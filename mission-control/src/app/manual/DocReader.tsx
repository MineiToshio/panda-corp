"use client";

import { Crumbs } from "@/components/core/Crumbs/Crumbs";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { MarkdownAnchorScope } from "@/components/core/Markdown/MarkdownAnchorScope";
import styles from "@/components/modules/DocumentReader/DocumentReader.module.css";
import { t } from "@/lib/copy/copy";
import { DOC_GROUPS, groupPages, groupTone, pageHref } from "./_components/DocsHome/model";
import chrome from "./_components/DocsHome/Reader.module.css";
import { DocNav } from "./DocNav";
import { getManualPageComponent } from "./manualPages";
import type { DocReaderProps } from "./types";

/** Reader chrome and the single authored body, with navigation confined to the current group. */
export function DocReader({ page, pages }: DocReaderProps): React.JSX.Element {
  const siblings = groupPages(pages, page.group);
  const position = siblings.findIndex((entry) => entry.slug === page.slug);
  const previous = siblings[position - 1];
  const next = siblings[position + 1];
  const group = t(
    DOC_GROUPS.find((entry) => entry.id === page.group)?.key ?? "documentacion.title",
  );
  const Renderer = getManualPageComponent(page.slug);
  const isTutorial = page.group === "tutorial";
  const vars = { index: position + 1, total: siblings.length };
  return (
    <div
      className={`reader ${styles.reader}`}
      data-testid="doc-reader"
      data-tone={groupTone(page.group)}
    >
      <article className={`paper ${styles.paper}`} data-testid="doc-reader-authored">
        <div className={chrome.head}>
          <Crumbs
            items={[
              { label: t("documentacion.title"), href: "/manual" },
              { label: group, href: siblings[0] ? pageHref(siblings[0]) : "/manual" },
              { label: page.title },
            ]}
          />
          <span className={chrome.counter}>
            {t(
              isTutorial ? "documentacion.reader.stepOf" : "documentacion.reader.positionOf",
              vars,
            )}
          </span>
        </div>
        {isTutorial ? (
          <div
            className={`docs-progress ${chrome.progress}`}
            role="progressbar"
            aria-label={t("documentacion.reader.tutorialProgressAria", vars)}
            aria-valuemin={0}
            aria-valuemax={siblings.length}
            aria-valuenow={position + 1}
          >
            {siblings.map((entry, index) => (
              <span key={entry.slug} data-on={index <= position} />
            ))}
          </div>
        ) : null}
        <MarkdownAnchorScope style={{ minWidth: 0 }} tone={groupTone(page.group)}>
          {Renderer ? (
            <Renderer />
          ) : (
            <>
              <h2>{page.title}</h2>
              <Markdown>{page.body.replace(/^\s*# [^\n]*(?:\n|$)/, "")}</Markdown>
            </>
          )}
        </MarkdownAnchorScope>
        <div className={chrome.navigation}>
          {previous ? (
            <a className={`docs-nav ${chrome.card}`} href={pageHref(previous)}>
              <small>{t("documentacion.reader.previousIn", { group })}</small>
              <strong>{previous.title}</strong>
            </a>
          ) : null}
          {next ? (
            <a className={`docs-nav ${chrome.card}`} href={pageHref(next)}>
              <small>{t("documentacion.reader.nextIn", { group })}</small>
              <strong>{next.title}</strong>
            </a>
          ) : null}
        </div>
      </article>
      <DocNav pages={pages} page={page} />
    </div>
  );
}

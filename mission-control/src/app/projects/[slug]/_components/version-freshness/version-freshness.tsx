import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";
import type { OverlayFreshnessState } from "@/lib/overlay-freshness/overlay-freshness";
import styles from "./version-freshness.module.css";

export interface VersionFreshnessProps {
  readonly state: OverlayFreshnessState;
  readonly projectName: string;
}

/** Only a strictly older overlay earns an upgrade notice; the command is copy-only. */
export function VersionFreshness({
  state,
  projectName,
}: VersionFreshnessProps): React.JSX.Element | null {
  if (state.reason !== "behind") return null;
  return (
    <section data-testid="version-freshness" aria-label={t("workspace.resumen.upgrade.aria")}>
      <Notice icon="alert" tone="amber">
        <div className={styles.notice}>
          <div className={styles.body}>
            <strong>{t("workspace.resumen.upgrade.title")}</strong>
            <p>
              {t("workspace.resumen.upgrade.body", {
                projectVersion: state.projectVersion ?? "",
                factoryVersion: state.factoryVersion ?? "",
              })}
            </p>
          </div>
          <div className={styles.command}>
            <p>{t("workspace.resumen.upgrade.runIn", { project: projectName })}</p>
            <CmdRow
              variant="box"
              command={state.upgradeCommand}
              copyLabel={`Copiar ${state.upgradeCommand}`}
            />
          </div>
        </div>
      </Notice>
    </section>
  );
}

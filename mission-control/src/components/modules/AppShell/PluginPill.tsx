import Link from "next/link";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";

export function PluginPill({
  state,
}: {
  readonly state: PluginSyncState | null;
}): React.JSX.Element | null {
  if (!state?.drift) return null;
  const behind = state.runtimes
    ? Object.values(state.runtimes).filter((runtime) => runtime.drift)
    : [state];
  const title = behind
    .map((runtime) =>
      t("shell.plugin.title", {
        installed: runtime.installedVersion ?? "—",
        source: runtime.sourceVersion ?? "—",
      }),
    )
    .join(" · ");
  return (
    <Link
      href="/"
      className="plugin-pill"
      data-tone="coral"
      title={title}
      aria-label={t("shell.plugin.outdated")}
    >
      <Icon name="alert" />
      <span className="lbl">{t("shell.plugin.outdated")}</span>
    </Link>
  );
}

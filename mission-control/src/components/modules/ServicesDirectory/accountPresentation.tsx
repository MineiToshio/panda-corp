"use client";
import { useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { CopyText } from "@/components/core/CopyText/CopyText";
import { type CopyKey, t } from "@/lib/copy/copy";
import type { ServiceAccount, ServiceAllocation, ServiceProvider } from "@/lib/services/types";
import styles from "./ServicesDirectory.module.css";

/** Service-domain states have their own words, independent of work-order states. */
export function AccountState({
  state,
  directory = false,
}: {
  state: string;
  directory?: boolean;
}): React.JSX.Element {
  const labels: Record<string, CopyKey> = directory
    ? {
        active: "portafolio.accounts.status.active",
        pending: "portafolio.accounts.status.pending",
        candidate: "portafolio.accounts.status.candidate",
        reference: "portafolio.accounts.status.reference",
      }
    : {
        configured: "workspace.cuentas.serviceStatus.configured",
        proposed: "workspace.cuentas.serviceStatus.proposed",
        inactive: "workspace.cuentas.serviceStatus.inactive",
      };
  const tone = ["active", "configured"].includes(state)
    ? "green"
    : ["pending", "proposed"].includes(state)
      ? "amber"
      : "slate";
  return (
    <span className={`state-dot ${styles.state}`} data-tone={tone}>
      <span aria-hidden="true" />
      {t(labels[state] ?? "portafolio.accounts.toVerify")}
    </span>
  );
}
/** Resource names remain tooltips; all environments share the teal category hue. */
export function Environments({
  resources,
}: {
  resources: ServiceAllocation["resources"];
}): React.JSX.Element {
  return (
    <span className={`env-chips ${styles.environments}`}>
      {resources.length ? (
        resources.map((resource) => (
          <span key={resource.environment} title={resource.resourceName ?? ""}>
            <Chip tone="teal">{resource.environment}</Chip>
          </span>
        ))
      ) : (
        <span className={styles.faint}>
          <span aria-hidden="true">−</span>
          <span className="sr-only">{t("common.none")}</span>
        </span>
      )}
    </span>
  );
}
/** Dashboard URLs have already passed the reader's HTTPS allowlist. */
export function ProviderLink({
  provider,
  href,
}: {
  provider: ServiceProvider;
  href: string;
}): React.JSX.Element {
  return (
    <a
      className={`acc-name ${styles.name}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t("workspace.cuentas.openPanelTitle", { provider: provider.name })}
    >
      <b>{provider.name}</b>
      <span className="sr-only">{t("common.newTab.srSuffix")}</span>
    </a>
  );
}
/** No credentials are accepted here: only the reader's non-secret login identifier. */
export function AccountLogin({
  login,
  provider,
}: {
  login: string | null;
  provider: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <>
      {login ? (
        <CopyText
          text={login}
          ariaLabel={t("workspace.cuentas.copyUserAria", { provider, login })}
          onResult={setCopied}
        />
      ) : (
        <span className={styles.faint}>{t("portafolio.accounts.unidentified")}</span>
      )}
      {copied !== null && (
        <span role="status">
          {t(copied ? "states.toast.copied" : "states.toast.clipboardBlocked")}
        </span>
      )}
    </>
  );
}

/** Only real accounts carry dated identity observations. */
export function AccountAccess({ account }: { account: ServiceAccount }): React.JSX.Element {
  const access: Record<string, CopyKey> = {
    historical_identity_verified: "dialogs.account.access.historicalIdentityVerified",
    unverified: "dialogs.account.access.unverified",
    access_required: "dialogs.account.access.accessRequired",
    unavailable: "dialogs.account.access.unavailable",
  };
  return (
    <span>
      {t(access[account.accessStatus] ?? "dialogs.account.access.unverified")} ·{" "}
      {account.observedAt ?? t("common.noDate")}
    </span>
  );
}

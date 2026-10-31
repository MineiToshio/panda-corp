"use client";
import buttonStyles from "@/components/core/Button/Button.module.css";
import { Chip } from "@/components/core/Chip/Chip";
import { DialogSheet } from "@/components/core/Modal/DialogSheet";
import { Modal } from "@/components/core/Modal/Modal";
import { type CopyKey, t } from "@/lib/copy/copy";
import type { DirectoryAccountRow } from "@/lib/services/views";
import { AccountAccess, AccountLogin, AccountState } from "./accountPresentation";

const AUTOMATION: Record<string, CopyKey> = {
  documented: "dialogs.account.automationStatus.documented",
  access_tested: "dialogs.account.automationStatus.accessTested",
  provision_tested: "dialogs.account.automationStatus.provisionTested",
  pending: "dialogs.account.automationStatus.pending",
};
const ADOPTION: Record<string, CopyKey> = {
  base: "dialogs.account.adoption.base",
  optional: "dialogs.account.adoption.optional",
  project_specific: "dialogs.account.adoption.projectSpecific",
  reference: "dialogs.account.adoption.reference",
};
/** Account details preserve dated observations and distinguish documentation from tested access. */
export function AccountDetail({
  row,
  onClose,
}: {
  row: DirectoryAccountRow;
  onClose: () => void;
}): React.JSX.Element {
  const { provider, account, allocations } = row;
  const rows = accountFacts(row);
  return (
    <Modal
      open
      onClose={onClose}
      title={account?.displayName ?? provider.name}
      badge={t("dialogs.account.kicker", { provider: provider.name })}
      testIdBase="account"
    >
      <div>
        <AccountState state={row.state} directory />{" "}
        <Chip tone="slate">
          {t(ADOPTION[provider.adoption] ?? "dialogs.account.adoption.optional")}
        </Chip>
      </div>
      <DialogSheet rows={rows} />
      <h3>{t("dialogs.account.linkedProjects")}</h3>
      {allocations.length ? (
        <ul>
          {allocations.map((link) => (
            <li key={`${link.projectId}:${link.integrationId}`}>
              {link.projectHref ? (
                <a href={link.projectHref}>{link.projectName}</a>
              ) : (
                link.projectName
              )}
              <AccountState state={link.status} />
              {link.resources.map((resource) => (
                <span key={resource.environment}>
                  {resource.environment} ·{" "}
                  {resource.resourceName ?? t("portafolio.accounts.toVerify")}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("dialogs.account.noLinks")}</p>
      )}
      <h3>{t("dialogs.account.howToReuse")}</h3>
      <p>{provider.reusePolicy}</p>
      <p>{provider.environmentPolicy}</p>
      <ol>
        {provider.automation.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a
        className={buttonStyles.btn}
        href={account?.dashboardUrl ?? provider.dashboardUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("dialogs.account.openPanel", { provider: provider.name })}
        <span className="sr-only">{t("common.newTab.srSuffix")}</span>
      </a>
    </Modal>
  );
}

function accountFacts({ provider, account }: DirectoryAccountRow) {
  const unknown = t("portafolio.accounts.toVerify");
  return [
    { id: "purpose", label: t("dialogs.account.purpose"), content: provider.purpose },
    {
      id: "email",
      label: t("dialogs.account.email"),
      content: account?.loginEmail ? (
        <AccountLogin login={account.loginEmail} provider={provider.name} />
      ) : (
        unknown
      ),
    },
    ...(account
      ? [
          {
            id: "identity",
            label: t("dialogs.account.identity"),
            content: <AccountAccess account={account} />,
          },
        ]
      : []),
    {
      id: "plan",
      label: t("dialogs.account.plan"),
      content: (
        <>
          {account?.plan ?? unknown}
          {account?.quotaSnapshot && (
            <p>
              {account.quotaSnapshot.metric} · {account.quotaSnapshot.limit ?? unknown} /{" "}
              {account.quotaSnapshot.usage ?? unknown} {account.quotaSnapshot.unit} ·{" "}
              {account.quotaSnapshot.observedAt ?? t("common.noDate")} ·{" "}
              {account.quotaSnapshot.source}
            </p>
          )}
        </>
      ),
    },
    {
      id: "automation",
      label: t("dialogs.account.automation"),
      content: t(
        AUTOMATION[account?.automationStatus ?? provider.automation.status] ??
          "dialogs.account.automationStatus.pending",
      ),
    },
    ...(account
      ? [
          {
            id: "accepts",
            label: t("dialogs.account.acceptsNew"),
            content: t(account.acceptingNewProjects ? "common.yes" : "common.no"),
          },
        ]
      : []),
    { id: "next", label: t("dialogs.account.nextStep"), content: account?.nextStep ?? unknown },
  ];
}

"use client";
import { useRouter } from "next/navigation";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import { navigationHref } from "@/lib/navigation/urls";
import { servicesCopy as c } from "./copy";
/** Portfolio-level tabs preserve the selected workspace and browser history. */
export function PortfolioViews({
  accounts,
  href,
}: {
  accounts: boolean;
  href: string;
}): React.JSX.Element {
  const router = useRouter();
  function handleChange(id: string): void {
    router.push(navigationHref(href, { portfolioView: id === "accounts" ? "accounts" : null }));
  }
  return (
    <SubTabs
      tabs={[
        { id: "projects", label: c.projectsTab },
        { id: "accounts", label: c.accountsTab },
      ]}
      active={accounts ? "accounts" : "projects"}
      onChange={handleChange}
      ariaLabel={c.portfolioTabs}
    />
  );
}

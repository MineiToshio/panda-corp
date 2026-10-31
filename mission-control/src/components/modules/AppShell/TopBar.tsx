import Image from "next/image";
import { IconButton } from "@/components/core/Button/IconButton";
import { NAV_DESTINATIONS, type NavDestinationId } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import styles from "./AppShell.module.css";

/** Phone-only sticky identity and drawer opener. */
export function TopBar({
  active,
  location,
  open,
  onOpen,
}: {
  readonly location?: React.ReactNode;
  readonly active: NavDestinationId | null;
  readonly open: boolean;
  readonly onOpen: React.MouseEventHandler<HTMLButtonElement>;
}): React.JSX.Element {
  const destination = NAV_DESTINATIONS.find((item) => item.id === active);
  return (
    <header className={`topbar ${styles.topbar}`}>
      <IconButton
        id="menu"
        icon="menu"
        className={styles.menu}
        label={t("shell.topbar.openMenu")}
        aria-expanded={open}
        aria-controls="sidebar"
        onClick={onOpen}
      />
      <Image src="/brand/pandacorp.png" alt="" width={30} height={30} />
      <div id="where" className={`where ${styles.where}`}>
        {location ?? (
          <>
            {destination ? t(destination.labelKey) : t("shell.brand.name")}
            <small>{t("shell.brand.product")}</small>
          </>
        )}
      </div>
    </header>
  );
}

import type { Tone } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Notice.module.css";

export interface NoticeProps {
  readonly icon: IconName;
  /** Hue of the tint; ignored by the `error` kind, which is always coral. */
  readonly tone?: Tone;
  /** `error` is the one read-error state every surface uses: coral, announced, domain message only. */
  readonly kind?: "info" | "error";
  readonly children: React.ReactNode;
}

/** Tinted message with an icon and text (upgrade, error, unavailable source). The caller passes the domain message. */
export function Notice({
  icon,
  tone = "slate",
  kind = "info",
  children,
}: NoticeProps): React.JSX.Element {
  return (
    <div
      className={`notice ${styles.notice}`}
      data-tone={kind === "error" ? "coral" : tone}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Button.module.css";

export interface IconButtonProps {
  readonly icon: IconName;
  /** Required Spanish accessible name: an icon alone names nothing. */
  readonly label: string;
  readonly onClick?: React.MouseEventHandler<HTMLButtonElement>;
  readonly disabled?: boolean;
}

/** 40 px square icon-only action button; its accessible name is mandatory. */
export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
}: IconButtonProps): React.JSX.Element {
  if (!label.trim()) throw new Error("IconButton needs a non-empty accessible label");
  return (
    <button
      type="button"
      className={`btn ${styles.btn} ${styles.icon}`}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}

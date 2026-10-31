import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Button.module.css";

export interface IconButtonProps extends Omit<React.AriaAttributes, "aria-label"> {
  readonly id?: string;
  readonly className?: string;
  readonly icon: IconName;
  /** Required Spanish accessible name: an icon alone names nothing. */
  readonly label: string;
  readonly onClick?: React.MouseEventHandler<HTMLButtonElement>;
  readonly disabled?: boolean;
  readonly "data-testid"?: string;
}

/** 40 px square icon-only action button; its accessible name is mandatory. */
export function IconButton({
  icon,
  label,
  id,
  className,
  onClick,
  disabled = false,
  "data-testid": testId,
  ...ariaProps
}: IconButtonProps): React.JSX.Element {
  if (!label.trim()) throw new Error("IconButton needs a non-empty accessible label");
  return (
    <button
      {...ariaProps}
      id={id}
      type="button"
      data-testid={testId}
      className={`iconbtn ${styles.btn} ${styles.icon} ${className ?? ""}`}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}

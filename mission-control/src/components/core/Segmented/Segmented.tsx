import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Segmented.module.css";

interface SegmentedOption {
  readonly icon?: IconName;
  readonly value: string;
  readonly label: string;
}

export interface SegmentedProps {
  /** Accessible name of the group. */
  readonly label: string;
  readonly options: readonly SegmentedOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** Segmented control: native buttons whose state is `aria-pressed`; the selected look is neutral. */
export function Segmented({ label, options, value, onChange }: SegmentedProps): React.JSX.Element {
  return (
    <fieldset className={`seg ${styles.seg}`}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size="sm" /> : null}
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

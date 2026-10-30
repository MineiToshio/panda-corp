"use client";

import { useId } from "react";
import { Icon } from "@/components/core/Icon/Icon";
import styles from "./Field.module.css";

export interface SearchFieldProps {
  /** Spanish accessible name (the catalogue's `…Aria` string). */
  readonly label: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** 40 px labelled search input, at most 480 px wide and full width on phones. */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
}: SearchFieldProps): React.JSX.Element {
  const id = useId();
  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }
  return (
    <div className={`field ${styles.field} ${styles.search}`}>
      <Icon name="search" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}

export interface SelectFieldProps {
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** Labelled native select with a chevron. */
export function SelectField({
  label,
  options,
  value,
  onChange,
}: SelectFieldProps): React.JSX.Element {
  const id = useId();
  function handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    onChange(event.target.value);
  }
  return (
    <div className={`field ${styles.field}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} value={value} onChange={handleChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevD" size="sm" />
    </div>
  );
}

export interface SwitchProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** On/off switch: `role="switch"` with `aria-checked`; state is also told by the label, never by colour alone. */
export function Switch({ label, checked, onChange }: SwitchProps): React.JSX.Element {
  function handleClick(): void {
    onChange(!checked);
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${styles.switch}`}
      onClick={handleClick}
    >
      <span className={styles.track} aria-hidden="true">
        <span />
      </span>
      {label}
    </button>
  );
}

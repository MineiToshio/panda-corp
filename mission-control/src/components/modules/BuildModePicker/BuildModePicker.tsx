"use client";

import { useState } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { SelectField } from "@/components/core/Field/Field";
import {
  type BuildAction,
  type BuildTarget,
  buildCommand,
  isBuildTarget,
} from "@/lib/build-mode-store";
import { BUILD_ENTRY_COPY as copy } from "@/lib/constants";
import styles from "./BuildModePicker.module.css";

export interface BuildModePickerProps {
  readonly project?: string;
  readonly targets?: readonly BuildTarget[];
}

/** A keyed inner view prevents action/target state leaking across project navigation. */
export function BuildModePicker({ project, targets }: BuildModePickerProps) {
  return <BuildEntry key={project ?? ""} targets={targets} />;
}

function BuildEntry({ targets = [] }: Pick<BuildModePickerProps, "targets">) {
  const [action, setAction] = useState<BuildAction>("build");
  const [selected, setSelected] = useState("");
  const available = targets.filter(isBuildTarget);
  const target = available.find((item) => item.value === selected);
  const command = buildCommand(action, target?.value);
  return (
    <div className={styles.picker} data-tone="violet" data-testid="build-mode-picker">
      <fieldset className={styles.grid} aria-label={copy.group}>
        {(["build", "resume", "target"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            className={styles.mode}
            aria-pressed={action === entry}
            onClick={() => setAction(entry)}
          >
            <b>{copy[entry]}</b>
          </button>
        ))}
      </fieldset>
      <p className={styles.intro}>{copy[`${action}Hint`]}</p>
      {action === "target" && (
        <>
          <SelectField
            label={copy.targetAria}
            value={target?.value ?? ""}
            onChange={setSelected}
            options={[{ value: "", label: copy.placeholder }, ...available]}
          />
          <p>
            {!available.length
              ? copy.empty
              : !target
                ? copy.choose
                : target.value.startsWith("FRD-")
                  ? copy.frdScope
                  : ""}
          </p>
          {target?.status === "draft" && <p>{copy.draft}</p>}
        </>
      )}
      {command && (
        <div className={styles.command} data-testid="mode-cmd">
          <CmdRow variant="box" command={command} />
        </div>
      )}
      <p className={styles.intro}>{copy.note}</p>
    </div>
  );
}

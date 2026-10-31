"use client";

import { useState } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { SelectField } from "@/components/core/Field/Field";
import { t } from "@/lib/copy/copy";

/** One reader-supplied target; the value is the exact build CLI identifier. */
export interface BuildTarget {
  readonly value: string;
  readonly label: string;
}
/** View-local selection; a forged value cannot become a copyable command. */
export function BuildTargetPicker({
  targets = [],
}: {
  readonly targets?: readonly BuildTarget[];
}): React.JSX.Element {
  const [selected, setSelected] = useState("");
  const value = targets.some((target) => target.value === selected) ? selected : "";
  function select(next: string): void {
    if (next === "" || targets.some((target) => target.value === next)) setSelected(next);
  }
  return (
    <>
      <p>{t("workspace.comandos.target.intro")}</p>
      <SelectField
        label={t("workspace.comandos.target.aria")}
        value={value}
        onChange={select}
        options={[{ value: "", label: t("workspace.comandos.target.placeholder") }, ...targets]}
      />
      <CmdRow variant="box" command={`/pandacorp:implement ${value || "<id>"}`} />
    </>
  );
}

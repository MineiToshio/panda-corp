"use client";
import { SelectField } from "@/components/core/Field/Field";
import { t } from "@/lib/copy/copy";
import type { ProjectFrd } from "@/lib/frds/frd-index";
export interface WoFrdFilterProps {
  frds: string[];
  selected: string | null;
  onSelect: (frd: string | null) => void;
  index?: readonly ProjectFrd[];
}
/** One labelled native select; the index supplies the shared FRD identity. */
export function WoFrdFilter({
  frds,
  selected,
  onSelect,
  index = [],
}: WoFrdFilterProps): React.JSX.Element {
  return (
    <SelectField
      label={t("workspace.observabilidad.filters.frdLabel")}
      value={selected ?? ""}
      onChange={(value) => onSelect(value || null)}
      options={[
        { value: "", label: t("workspace.observabilidad.filters.allFrds", { count: frds.length }) },
        ...frds.map((value) => {
          const frd = index.find((item) => item.code === value || item.slug === value);
          return { value, label: frd ? `${frd.code} · ${frd.title}` : value };
        }),
      ]}
    />
  );
}

import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { t } from "@/lib/copy/copy";
/** A legitimate empty project retains its documents and a copy-only architecture command. */
export function WorkOrderEmpty(): React.JSX.Element {
  return (
    <div data-testid="wo-empty">
      <EmptyState icon="clipboard">
        {t("workspace.observabilidad.empty")}
        <CmdRow variant="box" command="/pandacorp:architecture" />
      </EmptyState>
    </div>
  );
}

"use client";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/core/Button/Button";
import { DialogConfirm } from "@/components/core/Modal/DialogConfirm";
import { t } from "@/lib/copy/copy";
import type { RestoreResult } from "@/lib/discard/restore";

export interface RestoreButtonProps {
  readonly slug: string;
  readonly title?: string;
  readonly restoreAction: (slug: string) => Promise<RestoreResult>;
}

/** Confirm restoring the idea through the shared dialog, then submit its slug. */
export function RestoreButton({
  slug,
  title = slug,
  restoreAction,
}: RestoreButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [result, submit, pending] = useActionState<RestoreResult | null, FormData>(
    async (_previous, _data) => {
      setOpen(false);
      return restoreAction(slug);
    },
    null,
  );
  function confirm(): void {
    form.current?.requestSubmit();
  }
  return (
    <>
      <Button
        variant="default"
        size="sm"
        icon="rotate"
        disabled={pending}
        onClick={() => setOpen(true)}
        data-testid="restore-button"
      >
        {t("idea.header.restore")}
      </Button>
      <DialogConfirm
        open={open}
        title={t("dialogs.confirm.restoreIdea.title")}
        testIdBase="restore"
        cancelLabel={t("dialogs.confirm.cancel")}
        confirmLabel={t("dialogs.confirm.restoreIdea.verb")}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      >
        <p>{t("dialogs.confirm.kicker")}</p>
        <p>{t("dialogs.confirm.restoreIdea.text", { title })}</p>
        <form ref={form} action={submit} onSubmit={() => setOpen(false)}></form>
      </DialogConfirm>
      {result?.ok && (
        <span role="status" data-testid="restore-done">
          {t("idea.header.restore")}
        </span>
      )}
    </>
  );
}

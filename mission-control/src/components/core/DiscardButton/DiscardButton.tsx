"use client";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/core/Button/Button";
import { DialogConfirm } from "@/components/core/Modal/DialogConfirm";
import { t } from "@/lib/copy/copy";
import type { DiscardResult } from "@/lib/discard/discard";

export interface DiscardButtonProps {
  readonly slug: string;
  readonly title?: string;
  readonly discardAction: (slug: string, reason?: string) => Promise<DiscardResult>;
}

/** Confirm through the shared dialog; the reason is posted in the form body only. */
export function DiscardButton({
  slug,
  title = slug,
  discardAction,
}: DiscardButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [result, submit, pending] = useActionState<DiscardResult | null, FormData>(
    async (_previous, data) => {
      setOpen(false);
      return discardAction(slug, String(data.get("reason") ?? "").trim());
    },
    null,
  );
  function confirm(reason: string): void {
    const field = form.current?.elements.namedItem("reason");
    if (field instanceof HTMLInputElement) field.value = reason;
    form.current?.requestSubmit();
  }
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => setOpen(true)}
        data-testid="discard-button"
      >
        {t("idea.header.discard")}
      </Button>
      <DialogConfirm
        open={open}
        title={t("dialogs.confirm.discardIdea.title")}
        testIdBase="discard"
        cancelLabel={t("dialogs.confirm.cancel")}
        confirmLabel={t("dialogs.confirm.discardIdea.verb")}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        reasonLabel={t("dialogs.confirm.reasonLabel")}
        reasonPlaceholder={t("dialogs.confirm.reasonPlaceholder")}
        confirmVariant="danger"
      >
        <p>{t("dialogs.confirm.kicker")}</p>
        <p>{t("dialogs.confirm.discardIdea.text", { title })}</p>
        <form
          data-testid="discard-reason-form"
          ref={form}
          action={submit}
          onSubmit={() => setOpen(false)}
        >
          <input type="hidden" name="reason" />
        </form>
      </DialogConfirm>
      {result?.ok && (
        <span role="status" data-testid="discard-done">
          {t("idea.header.stageDiscarded")}
        </span>
      )}
    </>
  );
}

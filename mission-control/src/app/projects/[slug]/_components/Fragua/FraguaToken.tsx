"use client";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { statePresentation } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import { navigationHref } from "@/lib/navigation/urls";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import styles from "./Fragua.module.css";
/** Named work-order token. Touch activation navigates; hover/focus only reveals a card. */
export function FraguaToken({
  order,
  route,
  frdTitle,
}: {
  order: WorkOrder;
  route: string;
  frdTitle?: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 0, top: 0 });
  const button = useRef<HTMLButtonElement>(null),
    tip = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const presentation = statePresentation(order.state === "fail" ? "blocked" : order.state);
  const code = order.id.match(/^WO-(\d+)-(\d+)$/);
  const title = order.title.replace(/^WO-\d+-\d+\s*[—–:-]?\s*/, "");
  const summary = order.summary
    ?.replace(/[#*_`]/g, "")
    .match(/^[\s\S]*?[.!?](?:\s|$)|^[\s\S]+$/)?.[0]
    ?.trim();
  useEffect(() => {
    function close(): void {
      setOpen(false);
    }
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, []);
  useLayoutEffect(() => {
    if (!open || !button.current || !tip.current) return;
    const r = button.current.getBoundingClientRect(),
      s = tip.current.getBoundingClientRect();
    setPosition({
      left: Math.min(
        Math.max(8, r.left + r.width / 2 - s.width / 2),
        window.innerWidth - s.width - 8,
      ),
      top: r.top - s.height - 10 < 8 ? r.bottom + 10 : r.top - s.height - 10,
    });
  }, [open]);
  function handleActivate(): void {
    router.push(navigationHref(route, { tab: "observability", wo: order.id }));
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`token ${styles.token}`}
        data-tone={presentation.tone}
        data-wo={order.id}
        aria-label={t("workspace.resumen.forge.tokenAria", { id: order.id, title })}
        aria-describedby={open ? "tok-tip" : undefined}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={handleActivate}
      >
        <span className="tk-a">{code?.[1]}</span>
        <span className="tk-b">{code?.[2] ?? order.id}</span>
      </button>
      {open && (
        <div
          ref={tip}
          id="tok-tip"
          role="tooltip"
          className={`tok-tip ${styles.tip}`}
          style={position}
        >
          <b>{order.id}</b>
          <Chip tone={presentation.tone}>{t(presentation.labelKey)}</Chip>
          <strong>{title}</strong>
          {summary && <span>{summary}</span>}
          <span>
            {`FRD-${code?.[1] ?? ""}`}
            {frdTitle && ` · ${frdTitle}`}
          </span>
        </div>
      )}
    </>
  );
}

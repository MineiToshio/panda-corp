import { Chip } from "@/components/core/Chip/Chip";
import { FileReadErrors } from "@/components/modules/FileReadErrors/FileReadErrors";
import { t } from "@/lib/copy/copy";
import { formatRelative } from "@/lib/copy/dates";
import { type FraguaProject, loadFraguaScene } from "@/lib/fragua/scene-data";
import { formatSignalAge } from "@/lib/fragua/signal-age";
import { deriveVerdict } from "@/lib/fragua/verdict";
import styles from "./Fragua.module.css";
import { FraguaLive } from "./FraguaLive";
import { FraguaStation } from "./FraguaStation";
/** Scene inputs owned by other features are optional: unavailable facts are never fabricated. */
export interface FraguaSceneProps {
  readonly project: FraguaProject;
  readonly openChanges?: number | null;
  readonly ownerPending?: number | null;
  readonly lastActivityAt?: string | null;
  readonly frds?: readonly { slug: string; title: string }[];
}
/** Always-dark server scene. Its client islands handle only transport, expiry and token affordances. */
export function FraguaScene({
  project,
  openChanges,
  ownerPending,
  lastActivityAt,
  frds,
}: FraguaSceneProps): React.JSX.Element {
  const data = loadFraguaScene(project);
  if (data.errors?.length) return <FileReadErrors errors={data.errors} />;
  const verdict = deriveVerdict({
    ...data,
    openChanges,
    ownerPending,
    lastActivityAt,
    nowMs: Date.parse(data.nowIso),
  });
  const left = data.progress.total - data.progress.done;
  const n = (state: string) => data.orders.filter((order) => order.state === state).length;
  const busy = data.stations.flatMap((station, index) => (station.count ? [index] : []));
  const from = busy.at(0) ?? 0,
    to = busy.at(-1) ?? 0;
  const route = `/projects/${encodeURIComponent(project.slug)}/observability`;
  const age = formatSignalAge(data.signal.ageMinutes);
  const courierStyle = {
    left: `${(from + 0.5) * 25}%`,
    right: `${(3 - to + 0.5) * 25}%`,
    "--from": from,
    "--to": to,
    "--dur": `${(to - from) * 3}s`,
  } as React.CSSProperties;
  return (
    <FraguaLive project={data.eventProject} signal={data.signal} nowIso={data.nowIso}>
      <section
        className={`fragua ${styles.scene} ${data.signal.kind === "live" ? "is-live" : "is-idle"}`}
        aria-labelledby={`fr-h-${project.slug}`}
      >
        <div className={`fr-head ${styles.head}`}>
          <div>
            <span className={styles.eyebrow}>
              {t("workspace.resumen.forge.eyebrow", { project: project.name })}
            </span>
            <h2 id={`fr-h-${project.slug}`}>{verdict.text}</h2>
            <p>
              {data.signal.kind === "no-signal"
                ? t("workspace.resumen.forge.statusNoSignal", { ago: age })
                : t(
                    data.signal.kind === "live"
                      ? "workspace.resumen.forge.statusWorking"
                      : "workspace.resumen.forge.statusResting",
                  )}
            </p>
          </div>
          <Chip tone={verdict.presentation.tone} icon={verdict.presentation.icon}>
            {t(verdict.presentation.labelKey)}
          </Chip>
        </div>
        {data.orders.length ? (
          <>
            <div
              className={`fr-quest ${styles.quest}`}
              role="img"
              aria-label={t("workspace.resumen.forge.questAria", {
                done: n("done"),
                review: n("review"),
                inProgress: n("in_progress") + n("fail"),
                todo: n("todo"),
              })}
            >
              {["done", "review", "in_progress", "fail", "todo"].map((state, index) => (
                <span
                  key={state}
                  data-tone={(["green", "amber", "blue", "coral", "slate"] as const)[index]}
                  style={{ width: `${(n(state) / data.orders.length) * 100}%` }}
                />
              ))}
            </div>
            <div className={`fr-scene ${styles.stations}`}>
              <div className={styles.path} aria-hidden="true" />
              {data.signal.kind === "live" && to > from && (
                <>
                  <div
                    className={`fr-route ${styles.route}`}
                    style={courierStyle}
                    aria-hidden="true"
                  />
                  <div
                    className={`fr-courier ${styles.courier}`}
                    style={courierStyle}
                    aria-hidden="true"
                  >
                    <span className={styles.walker}>
                      {/* biome-ignore lint/performance/noImgElement: original pixel courier must keep its native bytes. */}
                      <img src="/prototype/assets/agents/courier.png" alt="" />
                    </span>
                  </div>
                </>
              )}
              {data.stations.map((station) => (
                <FraguaStation key={station.key} station={station} route={route} frds={frds} />
              ))}
            </div>
          </>
        ) : (
          <p>{t("workspace.resumen.forge.noOrders")}</p>
        )}
        <div className={`fr-foot ${styles.foot}`}>
          <span>
            <Chip tone={left ? "amber" : "green"}>
              {left
                ? t(
                    left === 1
                      ? "workspace.resumen.forge.missingOne"
                      : "workspace.resumen.forge.missingMany",
                    { count: left },
                  )
                : t("workspace.resumen.forge.allForged")}
            </Chip>
            {openChanges != null && (
              <Chip tone="pink">
                {t("workspace.resumen.forge.openChanges", { count: openChanges })}
              </Chip>
            )}
            <Chip tone="slate" variant="plain" icon="clock">
              {t("workspace.resumen.forge.lastMove", {
                ago: lastActivityAt
                  ? formatRelative(lastActivityAt.slice(0, 10), data.nowIso)
                  : t("common.relativeTime.noRecord"),
              })}
            </Chip>
          </span>
          <span className={styles.note}>{t("workspace.resumen.forge.note")}</span>
        </div>
      </section>
    </FraguaLive>
  );
}

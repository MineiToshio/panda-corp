import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import type { FraguaStationData } from "@/lib/fragua/stations";
import styles from "./Fragua.module.css";
import { FraguaToken } from "./FraguaToken";
/** One station, its fixed decorative crew, authoritative count and bounded token set. */
export function FraguaStation({
  station,
  route,
  frds,
}: {
  station: FraguaStationData;
  route: string;
  frds?: readonly { slug: string; title: string }[];
}): React.JSX.Element {
  return (
    <div
      className={`fr-station ${styles.station}`}
      data-tone={station.tone}
      data-station={station.state}
    >
      <div className={`fr-cast ${styles.cast}`} aria-hidden="true">
        {station.sprites.map((sprite, index) => (
          // biome-ignore lint/performance/noImgElement: original pixel sprites must keep their native bytes.
          <img
            key={sprite}
            src={`/prototype/assets/agents/${sprite}.png`}
            alt=""
            style={{
              animationDelay: `${-index * 0.8 - ({ todo: 0, inProgress: 1, review: 2, done: 3 }[station.key]) * 0.3}s`,
            }}
          />
        ))}
      </div>
      <div className={`fr-plate ${styles.plate}`}>
        <b>{t(`workspace.resumen.forge.stations.${station.key}.label`)}</b>
        <span className={`fr-count ${styles.count}`}>{station.count}</span>
        <span>{t(`workspace.resumen.forge.stations.${station.key}.sub`)}</span>
        {station.count ? (
          <div className={`tokens ${styles.tokens}`}>
            {station.tokens.map((order) => (
              <FraguaToken
                key={order.id}
                order={order}
                route={route}
                frdTitle={frds?.find((frd) => frd.slug === order.frd)?.title}
              />
            ))}
            {station.overflow > 0 && (
              <span className={`token-more ${styles.more}`}>+{station.overflow}</span>
            )}
          </div>
        ) : (
          <div className={`tokens is-empty ${styles.tokens}`}>
            <span className={styles.ghost} />
            <span className={styles.ghost} />
            <span className={styles.ghost} />
            <p className={styles.empty}>
              <Icon
                name={
                  station.key === "done" ? "lock" : station.key === "inProgress" ? "clock" : "check"
                }
                size="sm"
              />
              {t(`workspace.resumen.forge.stationEmpty.${station.key}`)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

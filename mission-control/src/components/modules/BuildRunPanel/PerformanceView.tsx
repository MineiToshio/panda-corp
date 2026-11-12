import { Card, CardHeader } from "@/components/core/Card/Card";
import type { PerformanceRecord } from "@/lib/build-run/types";
import styles from "./BuildRunPanel.module.css";
import { COPY } from "./copy";

const metric = (value: number | null): string => (value === null ? COPY.unknown : String(value));
/** Bounded retrospective history, with explicit basename-only attribution and null metrics. */
export function PerformanceView({
  records,
}: {
  readonly records: readonly PerformanceRecord[];
}): React.JSX.Element {
  return (
    <Card tone="slate">
      <CardHeader title={COPY.performance} icon="clock" />
      <div className={styles.root}>
        <p className={styles.meta}>{COPY.attribution}</p>
        {!records.length ? (
          <p>{COPY.empty}</p>
        ) : (
          records
            .slice(-5)
            .reverse()
            .map((record) => (
              <details key={`${record.run_id}:${record.start}`}>
                <summary>
                  {record.run_id} · {record.outcome} · {record.start}
                </summary>
                <dl className={styles.facts}>
                  {[
                    [COPY.version, record.plugin_version],
                    [COPY.start, record.start],
                    [COPY.end, record.end],
                    [COPY.outcome, record.outcome],
                    [
                      COPY.duration,
                      metric((Date.parse(record.end) - Date.parse(record.start)) / 1000),
                    ],
                    [COPY.ram, [record.ram_gib.min, record.ram_gib.max].map(metric).join(" / ")],
                    [
                      COPY.swap,
                      [record.swap_mb.start, record.swap_mb.peak, record.swap_mb.end]
                        .map(metric)
                        .join(" / "),
                    ],
                    [
                      COPY.diskMetric,
                      [record.disk_free_gib.start, record.disk_free_gib.end]
                        .map(metric)
                        .join(" / "),
                    ],
                    [
                      COPY.steps,
                      [record.start_step, record.sustained_step, record.recommended_start]
                        .map(metric)
                        .join(" / "),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className={styles.scroll}>
                  <table className={styles.table}>
                    <caption>{COPY.units}</caption>
                    <thead>
                      <tr>
                        {[COPY.kind, COPY.count, COPY.p50, COPY.p90].map((label) => (
                          <th scope="col" key={label}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(record.units_by_kind).map(([kind, stats]) => (
                        <tr key={kind}>
                          <th scope="row">{kind}</th>
                          <td>{stats.count}</td>
                          <td>{metric(stats.p50_s)}</td>
                          <td>{metric(stats.p90_s)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.scroll}>
                  <table className={styles.table}>
                    <caption>{COPY.samples}</caption>
                    <thead>
                      <tr>
                        {[COPY.time, COPY.sampleStep, COPY.llm, COPY.heavy].map((label) => (
                          <th scope="col" key={label}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {record.workers_over_time.map((sample) => (
                        <tr key={`${sample.t}:${sample.step}:${sample.live_b}:${sample.live_h}`}>
                          <th scope="row">{sample.t}</th>
                          <td>{sample.step}</td>
                          <td>{sample.live_b}</td>
                          <td>{sample.live_h}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>{COPY.scale}</h3>
                {record.scale_events.length ? (
                  <ul>
                    {record.scale_events.map((event) => (
                      <li key={`${event.at}:${event.from}:${event.to}:${event.reason}`}>
                        {event.at}: {event.from} → {event.to}, {event.reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{COPY.empty}</p>
                )}
              </details>
            ))
        )}
      </div>
    </Card>
  );
}

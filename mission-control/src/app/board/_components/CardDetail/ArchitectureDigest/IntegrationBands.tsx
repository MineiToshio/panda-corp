import type { ArchItem } from "@/lib/architecture/architecture";
import type { EnvVar } from "@/lib/architecture/env";
import {
  BULLET_DOT_STYLE,
  BULLET_ITEM_STYLE,
  BULLET_LIST_STYLE,
  BULLET_STRONG_STYLE,
  INNER_STYLE,
  INTRO_STYLE,
} from "../SpecDigest/SpecDigest.styles";
import {
  EMPTY_NOTE_STYLE,
  ENV_COMMENT_STYLE,
  ENV_ITEM_STYLE,
  ENV_LIST_STYLE,
  ENV_NAME_STYLE,
  SUBHEAD_STYLE,
} from "./ArchitectureDigest.styles";
import { ARCH_COPY } from "./copy.es";

function ServiceBullets({ items }: { items: ArchItem[] }) {
  return (
    <ul style={BULLET_LIST_STYLE}>
      {items.map((it) => (
        <li key={it.title} style={BULLET_ITEM_STYLE} data-testid="arch-service">
          <span style={BULLET_DOT_STYLE} aria-hidden="true" />
          <span>
            {it.desc === "" ? (
              it.title
            ) : (
              <>
                <span style={BULLET_STRONG_STYLE}>{it.title}</span> — {it.desc}
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EnvVars({ vars }: { vars: EnvVar[] }) {
  if (vars.length === 0) {
    return <p style={EMPTY_NOTE_STYLE}>Sin variables de entorno declaradas.</p>;
  }
  return (
    <div style={ENV_LIST_STYLE}>
      {vars.map((v) => (
        <div key={v.name} style={ENV_ITEM_STYLE} data-testid="arch-env">
          <code style={ENV_NAME_STYLE}>{v.name}</code>
          {v.comment !== "" && <span style={ENV_COMMENT_STYLE}>{v.comment}</span>}
        </div>
      ))}
    </div>
  );
}

/** Operational context follows stack choices; preserve authored facts rather than guessing vendor duplicates. */
export function ServicesBand({ services }: { services: ArchItem[] }) {
  return (
    <section style={INNER_STYLE} data-testid="arch-services">
      <h4 style={SUBHEAD_STYLE}>{ARCH_COPY.integrations}</h4>
      <p style={{ ...INTRO_STYLE, fontSize: "13px", marginBottom: "16px" }}>
        {ARCH_COPY.integrationsHelp}
      </p>
      <ServiceBullets items={services} />
    </section>
  );
}

/** Environment-variable names stay separate from integration narrative and never expose values. */
export function EnvBand({ env }: { env: EnvVar[] }) {
  return (
    <section style={INNER_STYLE} data-testid="arch-env-block">
      <h4 style={SUBHEAD_STYLE}>{ARCH_COPY.environment}</h4>
      <EnvVars vars={env} />
    </section>
  );
}

/**
 * app/manual/manualPages.tsx — FRD-08 Manual page registry (the faithful readers)
 *
 * Maps a Manual page `slug` → a React render function that reproduces the
 * prototype's corresponding page (index.html `manualLanding()`,
 * `manualQuickstart()`, `manualGuide()`, `docPage()`), composing the shared
 * primitives (DocH, Panel, CmdRow, Chip, ItemSlot) and the concept diagrams.
 *
 * Why a registry (not raw markdown): the prototype renders each page as composed
 * UI (cards, numbered steps, inline diagrams), which raw react-markdown can't
 * reproduce. DocReader looks up the slug here; an unmapped slug falls back to the
 * markdown reader (so authored pages without a bespoke layout still render).
 *
 * Design rules (FRD-13 / AGENTS.md): tokens only, light+dark first-class, Spanish
 * copy, meaning never by color alone.
 *
 * Traceability: CMP-08-readers → AC-08-002.3 (each Diátaxis page kind renders).
 */

import type React from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";
import { Panel } from "@/components/core/Panel/Panel";
import { ArchDiagram } from "@/components/modules/manual-diagrams/ArchDiagram";
import { ChannelsDiagram } from "@/components/modules/manual-diagrams/ChannelsDiagram";
import { CockpitDataDiagram } from "@/components/modules/manual-diagrams/CockpitDataDiagram";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { HooksDiagram } from "@/components/modules/manual-diagrams/HooksDiagram";
import { PipelineDiagram } from "@/components/modules/manual-diagrams/PipelineDiagram";
import {
  B,
  Body,
  ChipFlow,
  Code,
  Divider,
  Lead,
  NotePanel,
  Ul,
} from "@/components/modules/manual-diagrams/prose";
import { SelfLearningLoop } from "@/components/modules/manual-diagrams/SelfLearningLoop";
import { SnapshotMini } from "@/components/modules/manual-diagrams/SnapshotMini";
import { StacksTable } from "@/components/modules/manual-diagrams/StacksTable";
import { StateTable } from "@/components/modules/manual-diagrams/StateTable";
import { TeamDiagram } from "@/components/modules/manual-diagrams/TeamDiagram";

// ---------------------------------------------------------------------------
// Shared building blocks for the page bodies
// ---------------------------------------------------------------------------

const RIGHT_ARROW = (
  <i className="ti ti-arrow-right" aria-hidden="true" style={{ color: "var(--color-text3)" }} />
);

/** A numbered quickstart step (rpgpanel + accent itemslot number + body + cmd). */
function QuickStep({
  n,
  title,
  body,
  cmd,
}: {
  n: number;
  title: React.ReactNode;
  body: React.ReactNode;
  cmd?: string;
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: "10px" }}>
      <Panel variant="rpgpanel">
        <div style={{ display: "flex", gap: "11px", alignItems: "flex-start" }}>
          <ItemSlot
            size={30}
            tone="accent"
            aria-label={`Paso ${n}`}
            icon={
              <span
                style={{
                  fontFamily: "var(--font-pixel, monospace)",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                {n}
              </span>
            }
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
              {title}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "var(--color-text2)",
                lineHeight: 1.55,
                marginTop: "3px",
              }}
            >
              {body}
            </div>
            {cmd != null && (
              <div style={{ marginTop: "6px" }}>
                <CmdRow command={cmd} />
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** A numbered guide step row (the prototype `guiaDoc` step list inside a Panel). */
function GuideStep({
  n,
  isFirst,
  children,
}: {
  n: number;
  isFirst: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: "11px",
        alignItems: "flex-start",
        padding: "9px 0",
        borderTop: isFirst ? undefined : "1px solid var(--color-border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-pixel, monospace)",
          color: "var(--color-accent-text)",
          fontSize: "13px",
          flex: "0 0 auto",
          width: "16px",
          textAlign: "right",
        }}
      >
        {n}
      </span>
      <div
        style={{
          fontSize: "13px",
          color: "var(--color-text)",
          lineHeight: 1.55,
          flex: 1,
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Render a full guide page: DocH + intro + Panel(steps) + optional tip + extra. */
function GuidePage({
  title,
  intro,
  steps,
  tip,
  extraCmd,
}: {
  title: string;
  intro: React.ReactNode;
  steps: readonly React.ReactNode[];
  tip?: React.ReactNode;
  extraCmd?: string;
}): React.JSX.Element {
  return (
    <>
      <DocH title={title} level={1} />
      {intro != null && <Lead>{intro}</Lead>}
      <Panel>
        {steps.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static authored step list, stable order
          <GuideStep key={i} n={i + 1} isFirst={i === 0}>
            {step}
          </GuideStep>
        ))}
      </Panel>
      {tip != null && (
        <NotePanel icon="ti-bulb" iconColor="var(--color-warn)">
          {tip}
        </NotePanel>
      )}
      {extraCmd != null && (
        <div style={{ marginTop: "10px" }}>
          <CmdRow command={extraCmd} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TUTORIAL pages
// ---------------------------------------------------------------------------

const LANDING_FEATURES: readonly { icon: string; title: string; body: string }[] = [
  {
    icon: "ti-eye",
    title: "Solo-lectura",
    body: "nunca llama a Claude — solo lee archivos; el trabajo lo paga tu suscripción Max",
  },
  {
    icon: "ti-map-2",
    title: "Estado en vivo",
    body: "ideas, proyectos, work orders y los agentes trabajando en Mission Control",
  },
  {
    icon: "ti-terminal-2",
    title: "Te da el comando",
    body: "copias, pegas en Claude Code, vuelves y el estado ya avanzó",
  },
] as const;

function ManualLanding(): React.JSX.Element {
  return (
    <>
      <DocH title="Qué es Pandacorp" level={1} />
      <Panel>
        <Body size="15px" margin="0 0 8px">
          Operas una <B weight={600}>fábrica de software hecha 100% con IA</B>. Tú traes ideas o
          problemas; un equipo de agentes los investiga, documenta, diseña, arquitecta y construye
          como apps reales — con intervención humana mínima.
        </Body>
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text2)",
            lineHeight: 1.6,
            margin: "0 0 14px",
          }}
        >
          <B weight={600}>Pandacorp (Mission Control) es el tablero de mando:</B> te muestra el
          estado de todo y te dice exactamente <B weight={600}>qué comando pegar en Claude Code</B>{" "}
          para avanzar. Operar una fábrica así por terminal es árido; esto lo vuelve legible — y
          hasta divertido.
        </p>
        {/* Feature cards */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "0 0 16px" }}>
          {LANDING_FEATURES.map((f) => (
            <Panel key={f.title} variant="rpgpanel">
              <div style={{ minWidth: "165px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--color-text)",
                  }}
                >
                  <i
                    className={`ti ${f.icon}`}
                    aria-hidden="true"
                    style={{ fontSize: "15px", color: "var(--color-accent-text)" }}
                  />{" "}
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--color-text2)",
                    marginTop: "4px",
                    lineHeight: 1.45,
                  }}
                >
                  {f.body}
                </div>
              </div>
            </Panel>
          ))}
        </div>
        {/* Pipeline */}
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            margin: "2px 0 8px",
            color: "var(--color-text)",
          }}
        >
          <i
            className="ti ti-route"
            aria-hidden="true"
            style={{ fontSize: "14px", verticalAlign: "-2px", color: "var(--color-accent-text)" }}
          />{" "}
          El recorrido de una idea
        </div>
        <PipelineDiagram />
      </Panel>
      {/* Tour CTA */}
      <NotePanel icon="ti-player-play" iconColor="var(--color-accent-text)">
        <B weight={600}>¿Primera vez? Haz el tour.</B> Sigue UNA idea de punta a punta en ~5 min y
        mira a tu party construir — está en <B weight={600}>Empezar aquí → Cómo empezar</B>.
      </NotePanel>
    </>
  );
}

function ManualQuickstart(): React.JSX.Element {
  return (
    <>
      <DocH title="Tu primera misión" level={1} />
      <Lead>
        En unos minutos vas a llevar <B weight={600}>una idea</B> de cero hasta ver a tu party de
        agentes construyéndola en vivo. Lo único que necesitas: Mission Control abierto y Claude
        Code al lado.{" "}
        <i>Recuerda — Mission Control solo muestra; los comandos los pegas en Claude Code.</i>
      </Lead>
      <QuickStep
        n={1}
        title="Personaliza tu fábrica (solo la 1ª vez)"
        body="Corre el onboarding para que la fábrica conozca tus intereses y objetivos. Si ya lo hiciste, salta al paso 2."
        cmd="/pandacorp:onboarding"
      />
      <QuickStep
        n={2}
        title="Captura una idea"
        body="Describe algo que quieras construir. Nace una ficha en la columna «Descubierta» del Tablero, con investigación ligera y un score."
        cmd="/pandacorp:new-idea"
      />
      <QuickStep
        n={3}
        title="Conviértela en proyecto (handoff)"
        body="Corre el handoff con el nombre de tu idea. Nace su carpeta/repo y se documenta el MVP (investigación + PRD + FRDs). La tarjeta avanza a «Documentada»."
        cmd="/pandacorp:spec <tu-idea>"
      />
      <QuickStep
        n={4}
        title="Diseña y arquitecta"
        body="Dos pasos cortos: mockups navegables y luego el blueprint + work orders. Apruebas cada uno con un gate ligero."
        cmd="/pandacorp:design"
      />
      <QuickStep
        n={5}
        title="¡Construye y MIRA!"
        body={
          <>
            Lanza la construcción y abre el proyecto en <B weight={600}>Portfolio → Party</B>: vas a
            ver a tu party de agentes trabajando en el mapa RPG. Esa es tu primera victoria.
          </>
        }
        cmd="/pandacorp:implement"
      />
      <NotePanel icon="ti-bulb" iconColor="var(--color-warn)">
        <B weight={600}>Lo que acabas de ver:</B> Mission Control nunca llamó a Claude — solo leyó
        archivos y te dio el comando de cada paso; todo el trabajo salió de tu suscripción. ¿Quieres
        entender el porqué? Ve a <B weight={600}>Conceptos</B>. ¿Una tarea puntual? Mira las{" "}
        <B weight={600}>Guías</B>.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// GUIDE pages (the prototype's 7 guides)
// ---------------------------------------------------------------------------

function GuideCapturar(): React.JSX.Element {
  return (
    <GuidePage
      title="Capturar una idea"
      intro="Cuatro formas de llenar la columna «Descubierta». Todas corren en la fábrica (panda-corp)."
      steps={[
        <>
          Tienes una idea propia → <Code>/pandacorp:new-idea</Code> y la describes. Nace su ficha
          con score.
        </>,
        <>
          ¿La idea es difusa? → <Code>/pandacorp:explore</Code> para desarrollarla en conversación
          antes de capturarla.
        </>,
        <>
          Quieres que la fábrica busque por ti → <Code>/pandacorp:discover</Code> rastrea
          oportunidades reales (Reddit, foros, reviews).
        </>,
        <>
          Para decidir cuál avanzar → <Code>/pandacorp:recommend</Code> te da un ranking
          justificado, sin mover nada.
        </>,
      ]}
      tip={
        <>
          Las fichas viven en <Code>factory/ideas/</Code>. El estado de cada idea vive SOLO en su
          frontmatter; el Tablero solo lo lee.
        </>
      }
    />
  );
}

function GuideHandoff(): React.JSX.Element {
  return (
    <GuidePage
      title="Handoff: idea → proyecto"
      intro="El handoff es donde una idea deja de ser una ficha y nace como proyecto con su propio repo. Es el único comando que corres con el nombre de la idea."
      steps={[
        <>
          Desde la fábrica, corre <Code>/pandacorp:spec &lt;idea&gt;</Code> con el nombre de tu
          idea.
        </>,
        <>
          Se crea la carpeta/repo del proyecto y se copian las plantillas de la fábrica (overlay:
          CLAUDE.md, status.yaml…).
        </>,
        <>
          Un equipo de researchers investiga (competencia, fuentes, viabilidad) y el product-manager
          escribe el PRD + FRDs con criterios verificables por máquina.
        </>,
        <>
          La tarjeta avanza a «Documentada». Desde aquí, toda la documentación del producto vive en
          el proyecto.
        </>,
      ]}
      tip={
        <>
          Después del handoff, las demás fases (<Code>:design</Code>, <Code>:blueprint</Code>,{" "}
          <Code>:implement</Code>…) se corren DENTRO de la carpeta del proyecto, sin nombre.
        </>
      }
    />
  );
}

function GuideModo(): React.JSX.Element {
  return (
    <GuidePage
      title="Elegir modo de construcción"
      intro={
        <>
          <Code>/pandacorp:implement</Code> acepta un modo según con cuánta potencia quieras
          construir. Por defecto es Equilibrado. Lo cambias por proyecto en Portfolio → Party.
        </>
      }
      steps={[
        <>
          <B weight={600}>pro</B> — 1 agente, modelos económicos (sonnet/haiku). Más lento, mínimo
          consumo. Para plan Pro. → <Code>implement pro</Code>
        </>,
        <>
          <B weight={600}>balanced</B> (default) — equipo de ≤3 agentes, líder opus. Pensado para
          Max 5x. → <Code>implement</Code>
        </>,
        <>
          <B weight={600}>powerful</B> — hasta 5 agentes en paralelo, avanza más rápido. Para Max
          20x. → <Code>implement powerful</Code>
        </>,
        <>
          <B weight={600}>deep</B> — mejores modelos en todos + revisión adversarial extra. Para un
          proyecto especial. → <Code>implement deep</Code>
        </>,
      ]}
      tip={
        <>
          Siempre es <B weight={600}>reanudable</B>: si se corta, vuelves a correr{" "}
          <Code>implement</Code> y continúa desde la feature (FRD) pendiente.
        </>
      }
    />
  );
}

function GuideFeedback(): React.JSX.Element {
  return (
    <>
      <DocH title="Reportar un bug o responder una decisión" level={1} />
      <Lead>
        Mientras un proyecto se construye (o ya lanzado), tienes tres canales para meterle mano —
        todos por archivos, que el agente revisa en su próximo punto seguro, sin que tengas que
        pararlo.
      </Lead>
      <ChannelsDiagram />
      <NotePanel icon="ti-info-circle">
        Mission Control te resalta los puntos de decisión pendientes y los bugs por procesar en
        Portfolio → Resumen.
      </NotePanel>
    </>
  );
}

function GuideProbar(): React.JSX.Element {
  return (
    <GuidePage
      title="Probar sin parar al agente"
      intro="El punto seguro es un commit de git, no un estado del agente. Puedes probar el último verde mientras el agente sigue construyendo en su carpeta."
      steps={[
        "Mission Control te muestra el «último commit en verde · seguro para probar» (el último commit del build que pasó todos los gates) en Portfolio → Resumen.",
        <>
          Copia el comando del snapshot: crea un <Code>git worktree</Code> en otra carpeta apuntando
          a ese commit.
        </>,
        "Pruebas ahí, en paz, mientras el agente sigue en la suya. Da igual si está a medias: no tocas su carpeta.",
      ]}
      tip={
        <>
          El motor <B weight={600}>repara antes de bloquear</B>: si un WO o el gate de revisión
          falla, intenta repararlo. Si no puede, lo marca BLOCKED con motivo y sigue con las
          features independientes; HEAD queda siempre en el último verde verificado. Nada terminado
          se pierde.
        </>
      }
    />
  );
}

function GuideTraspaso(): React.JSX.Element {
  return (
    <GuidePage
      title="Pasar el proyecto a otra persona"
      intro="Toda la info para retomar un proyecto vive en archivos, no en el chat. Por eso se puede pasar a otra persona (u otra sesión, otra compu, o el celular)."
      steps={[
        <>
          El estado vive en <Code>.pandacorp/status.yaml</Code>; la bitácora de iteración en{" "}
          <Code>.pandacorp/comms/iteration.md</Code>; el avance en{" "}
          <Code>.pandacorp/comms/progress.md</Code>.
        </>,
        <>
          El know-how (estándares, agentes, comandos) llega por el <B weight={600}>plugin</B> — no
          hay que copiar nada de la fábrica al proyecto.
        </>,
        "La otra persona instala el plugin, abre el proyecto y Mission Control le da el contexto completo: el flujo, los comandos y el estado.",
      ]}
      tip="Regla de oro: cada dato vive en UN solo lugar; el otro lado guarda un puntero. Por eso el avance sobrevive a perder la conversación."
    />
  );
}

function GuidePlugin(): React.JSX.Element {
  return (
    <GuidePage
      title="Actualizar el plugin"
      intro="El know-how se empaqueta como un plugin de Claude Code. Tras editar algo del plugin, hay que actualizarlo o los cambios nuevos no toman efecto."
      steps={[
        "Commitea los cambios del plugin.",
        "Corre el comando de actualización (instala la versión = SHA del commit).",
        "Reinicia la sesión de Claude Code — los cambios aplican al reiniciar.",
      ]}
      tip="Mission Control te AVISA con un banner cuando editaste el plugin pero no lo actualizaste (compara el SHA instalado con el último commit del plugin)."
      extraCmd="claude plugin update pandacorp@panda-corp"
    />
  );
}

// ---------------------------------------------------------------------------
// CONCEPT pages (the prototype's docPage content)
// ---------------------------------------------------------------------------

function ConceptQueEs(): React.JSX.Element {
  return (
    <>
      <DocH title="Qué es Pandacorp" level={1} />
      <Panel>
        <Body>
          Pandacorp es una <B weight={600}>fábrica de software hecha 100% con IA</B>. Tú aportas
          ideas o problemas; la fábrica los investiga, documenta, diseña, arquitecta y construye
          como aplicaciones reales — con intervención humana mínima.
        </Body>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            margin: "14px 0",
          }}
        >
          <Chip tone="info">tu idea</Chip>
          {RIGHT_ARROW}
          <Chip tone="accent">la fábrica (agentes de IA)</Chip>
          {RIGHT_ARROW}
          <Chip tone="ok">app lanzada</Chip>
        </div>
        <Divider />
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            marginBottom: "6px",
            color: "var(--color-text)",
          }}
        >
          Dos objetivos
        </div>
        <Ul>
          <li>Apps que generen ingresos (muchas pequeñas suman).</li>
          <li>Apps que te faciliten la vida, monetizen o no.</li>
        </Ul>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)" }}>
          <B weight={500}>Esta app (Mission Control) es solo-lectura:</B> muestra el estado y te
          dice qué comando ejecutar. Nunca llama a Claude — el trabajo lo haces pegando los comandos
          en Claude Code, así sale de tu suscripción.
        </div>
      </Panel>
    </>
  );
}

function ConceptPipeline(): React.JSX.Element {
  return (
    <>
      <DocH title="El pipeline · de idea a producto" level={1} />
      <Lead>
        Cada idea recorre 6 etapas. La tarjeta avanza cuando apruebas el resultado de cada una; si
        no te gusta, re-corres el mismo comando y sigues puliendo (no avanza hasta tu ok). Copia el
        comando, pégalo en Claude Code en la carpeta que toca, y vuelve.
      </Lead>
      <Panel>
        <PipelineDiagram />
      </Panel>
      <NotePanel icon="ti-flag">
        <B weight={500}>El handoff:</B> la idea vive en la fábrica hasta <Code>spec</Code>; ahí nace
        su propia carpeta/repo y desde entonces toda la documentación del producto vive en el
        proyecto.
      </NotePanel>
      <NotePanel icon="ti-refresh" iconColor="var(--color-accent)">
        <B weight={500}>Iterar sin avanzar:</B> ¿no te gusta el output de una etapa? Vuelve a correr
        el mismo comando y sigues puliendo — la tarjeta no avanza hasta tu visto bueno. Tu feedback
        se guarda en <Code>.pandacorp/comms/iteration.md</Code>, así retomas aunque pierdas la
        conversación (otra sesión, otra compu, el celular).
      </NotePanel>
    </>
  );
}

function ConceptEquipo(): React.JSX.Element {
  return (
    <>
      <DocH title="El equipo de agentes" level={1} />
      <Lead>
        La fábrica no es un solo agente: es un equipo de obreros especializados que los skills
        delegan según la fase. Cada uno usa el modelo adecuado (opus para juicio, sonnet para tareas
        mecánicas). Su ficha completa está en <B weight={600}>Referencia → Agentes</B>.
      </Lead>
      <Panel>
        <TeamDiagram />
      </Panel>
    </>
  );
}

function ConceptEstandares(): React.JSX.Element {
  return (
    <>
      <DocH title="Estándares y reglas" level={1} />
      <Lead>
        El know-how de cómo se construye se inyecta en cada proyecto. Está en{" "}
        <B weight={600}>8 dominios</B>, cada regla con su severidad y cómo se verifica. Y las{" "}
        <B weight={600}>reglas de decisión</B> son los defaults pre-aprobados para que la IA no te
        pregunte cada vez. Todo el detalle en <B weight={600}>Referencia → Estándares</B> y{" "}
        <B weight={600}>Reglas de decisión</B>.
      </Lead>
      <Panel>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text2)",
            marginBottom: "8px",
          }}
        >
          Los 8 dominios de estándares
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            "Programación",
            "Arquitectura",
            "Diseño",
            "Tecnología",
            "Calidad",
            "Seguridad",
            "Operación",
            "Datos/Privacidad",
          ].map((d) => (
            <Chip key={d} tone="secondary">
              {d}
            </Chip>
          ))}
        </div>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.6 }}>
          <B weight={500}>Severidad:</B> <Chip tone="danger">MUST</Chip> obligatorio ·{" "}
          <Chip tone="warn">SHOULD</Chip> recomendado · <Chip tone="secondary">MAY</Chip> opcional.
          La IA solo te escala si va a romper un MUST.
        </div>
      </Panel>
    </>
  );
}

function ConceptArquitectura(): React.JSX.Element {
  return (
    <>
      <DocH title="Arquitectura del sistema" level={1} />
      <Lead>
        La fábrica (este repo) guarda el CÓMO: el know-how, la base de ideas y el portfolio. Los
        productos viven en repos separados, cada uno con su propia documentación. Mission Control
        solo refleja el estado.
      </Lead>
      <Panel>
        <ArchDiagram />
      </Panel>
      <NotePanel>
        <B weight={500}>Regla de oro:</B> cada dato vive en UN solo lugar; el otro lado guarda un
        puntero. El proyecto nunca necesita leer la fábrica para trabajar — los estándares llegan
        por el plugin.
      </NotePanel>
    </>
  );
}

function ConceptCockpit(): React.JSX.Element {
  return (
    <>
      <DocH title="Mission Control por dentro" level={1} />
      <Lead>
        Hoy ves un prototipo en HTML. La app real se construirá así — y es el primer proyecto que la
        fábrica construye para sí misma (dogfooding).
      </Lead>
      <div style={{ marginBottom: "10px" }}>
        <Panel>
          <CockpitDataDiagram />
        </Panel>
      </div>
      <Panel>
        <Ul>
          <li>
            <B weight={500}>Stack:</B> Next.js (App Router; los Server Components leen el
            filesystem) + TypeScript strict + Tailwind + Biome + Vitest.
          </li>
          <li>
            <B weight={500}>Sin base de datos:</B> el repo de la fábrica ES la base de datos. Sin
            auth. Escucha solo en 127.0.0.1.
          </li>
          <li>
            <B weight={500}>Nunca llama a Claude:</B> solo lee archivos. Toda ejecución la haces
            pegando comandos en Claude Code (tu suscripción Max).
          </li>
          <li>
            <B weight={500}>Única escritura:</B> marcar una idea «descartada» y reportar un bug a la
            bandeja.
          </li>
          <li>
            <B weight={500}>Se refresca solo:</B> re-lee los archivos cada pocos segundos tras
            ejecutar un comando.
          </li>
        </Ul>
      </Panel>
    </>
  );
}

function ConceptEstado(): React.JSX.Element {
  return (
    <>
      <DocH title="Estado y archivos · el modelo de datos" level={1} />
      <Lead>
        Todo el estado vive en archivos (no en una BD ni en el chat). Así el avance sobrevive a
        cortes, y la fábrica y Mission Control leen exactamente lo mismo.
      </Lead>
      <Panel>
        <div style={{ overflowX: "auto" }}>
          <StateTable />
        </div>
      </Panel>
    </>
  );
}

function ConceptHooks(): React.JSX.Element {
  return (
    <>
      <DocH title="Hooks, gates y seguridad" level={1} />
      <Lead>
        El principio: el modelo propone; <B weight={600}>scripts/CI/hooks verifican</B>. Un agente
        nunca marca sus propios checks.
      </Lead>
      <HooksDiagram />
      <NotePanel icon="ti-lock">
        Los gates humanos (producción, gastar dinero, borrar datos, comunicaciones externas) se
        aplican como <B weight={500}>reglas deny duras</B> en settings.json, no como límites dichos
        en la conversación.
      </NotePanel>
    </>
  );
}

function ConceptStacks(): React.JSX.Element {
  return (
    <>
      <DocH title="Stacks · golden paths" level={1} />
      <Lead>
        4 arquetipos probados. El <B weight={600}>architect</B> elige el que encaja (lo apruebas en
        el blueprint) y puede proponer algo mejor con trade-offs. Son combinables — el caso Funkos =
        D para recolectar + A para mostrar.
      </Lead>
      <StacksTable />
    </>
  );
}

function ConceptDesatendida(): React.JSX.Element {
  return (
    <>
      <DocH title="Construcción desatendida · técnico" level={1} />
      <Lead>
        Cómo <Code>implement</Code> lanza un workflow dinámico que corre por horas sin babysitting y
        deja siempre un punto probable.
      </Lead>
      <div style={{ marginBottom: "10px" }}>
        <Panel>
          <Ul>
            <li>
              <B weight={500}>Auto mode</B> (permisos): el agente deja de preguntar «¿continúo?»;
              solo para cuando necesita al owner o alcanza un freno de salud/presupuesto.
            </li>
            <li>
              <B weight={500}>Repara antes de bloquear</B>: si un WO o el gate de revisión falla, un
              agente diagnostica y arregla. Solo si no puede, marca BLOCKED con motivo (needs-owner
              | external | error) y sigue con features independientes.
            </li>
            <li>
              <B weight={500}>Frenos de salud/presupuesto</B>: tope de presupuesto, demasiados
              bloqueos seguidos (freno de salud), nada que construir. No hay freeze-on-red directo.
            </li>
            <li>
              <B weight={500}>Punto seguro = commit por FRD:</B> el gate escribe{" "}
              <Code>last_green_sha</Code> y <Code>safe_to_test</Code> en status.yaml al verificar
              cada feature.
            </li>
            <li>
              <B weight={500}>El workflow ES el loop</B> (corre hasta vaciar la cola y para solo,
              reanudable); <Code>/loop</Code> self-paced solo para correr en continuo. Background
              tasks + TaskStop para procesos largos.
            </li>
          </Ul>
        </Panel>
      </div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--color-text2)",
          marginBottom: "6px",
        }}
      >
        Probar un snapshot sin parar al agente
      </div>
      <Panel>
        <SnapshotMini />
      </Panel>
    </>
  );
}

function ConceptPlugin(): React.JSX.Element {
  return (
    <>
      <DocH title="El plugin" level={1} />
      <Lead>
        El know-how se empaqueta como un plugin de Claude Code, disponible en cualquier carpeta.
      </Lead>
      <div style={{ marginBottom: "10px" }}>
        <Panel>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-text2)",
              marginBottom: "6px",
            }}
          >
            Estructura
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "12px",
              color: "var(--color-text2)",
              lineHeight: 1.8,
            }}
          >
            plugin/
            <br />
            ├── skills/ · los comandos /pandacorp:*
            <br />
            ├── agents/ · los obreros especializados
            <br />
            ├── hooks/ · block-dangerous, verify-before-stop, eventos
            <br />
            └── templates/ · scaffolds por golden path
          </div>
        </Panel>
      </div>
      <Panel>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text2)",
            marginBottom: "6px",
          }}
        >
          Instalación y mantenimiento
        </div>
        <Body size="13px" margin="0 0 8px">
          Instalado desde un marketplace local, scope usuario,{" "}
          <B weight={500}>versión = SHA del commit</B>. Tras editar algo en plugin/:{" "}
          <Code>commit</Code> → <Code>claude plugin update</Code> → reiniciar sesión.
        </Body>
        <div style={{ fontSize: "12px", color: "var(--color-text2)" }}>
          <i
            className="ti ti-alert-triangle"
            aria-hidden="true"
            style={{ fontSize: "13px", verticalAlign: "-2px", color: "var(--color-warn)" }}
          />{" "}
          Mission Control detecta cuando editaste el plugin pero no lo actualizaste (compara el SHA
          instalado con el repo) y muestra un aviso.
        </div>
      </Panel>
    </>
  );
}

function ConceptAutoaprendizaje(): React.JSX.Element {
  return (
    <>
      <DocH title="Autoaprendizaje · cómo la fábrica se vuelve más lista" level={1} />
      <Lead>
        La fábrica aprende de cada proyecto: cada problema resuelto, veredicto de librería, truco o
        patrón se guarda como una <B weight={600}>lección reutilizable</B> en{" "}
        <Code>factory/memory/</Code>. Los agentes la consultan en el siguiente proyecto — así la
        fábrica se vuelve más lista y construye más rápido con el uso, sin reentrenar ningún modelo.
      </Lead>
      <Panel>
        <SelfLearningLoop />
      </Panel>

      <DocH title="Los 3 actores · quién hace qué" />
      <div style={{ marginBottom: "8px" }}>
        <Panel>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <i
              className="ti ti-feather"
              aria-hidden="true"
              style={{ fontSize: "18px", color: "var(--color-cat-2)", marginTop: "1px" }}
            />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
                El cronista (
                <span style={{ fontFamily: "var(--font-mono, monospace)" }}>librarian</span>) · el
                obrero
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--color-text2)",
                  marginTop: "3px",
                  lineHeight: 1.5,
                }}
              >
                Lee la bandeja y los rastros del proyecto y escribe las lecciones limpias. No lo
                llamas tú — trabaja por dentro cuando el comando se lo pide.
              </div>
            </div>
          </div>
        </Panel>
      </div>
      <div style={{ marginBottom: "8px" }}>
        <Panel>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <i
              className="ti ti-book"
              aria-hidden="true"
              style={{ fontSize: "18px", color: "var(--color-accent)", marginTop: "1px" }}
            />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)" }}>/pandacorp:memory</span>{" "}
                · el mando
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--color-text2)",
                  marginTop: "3px",
                  lineHeight: 1.5,
                }}
              >
                <B weight={500}>harvest</B> llena el cuaderno · <B weight={500}>review</B> lo limpia
                y propone ascensos · <B weight={500}>status</B> te muestra la cola. Nunca asciende
                nada por sí solo.
              </div>
            </div>
          </div>
        </Panel>
      </div>
      <Panel>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <i
            className="ti ti-school"
            aria-hidden="true"
            style={{ fontSize: "18px", color: "var(--color-ok)", marginTop: "1px" }}
          />
          <div>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
              <span style={{ fontFamily: "var(--font-mono, monospace)" }}>/pandacorp:learn</span> ·
              el ascenso
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text2)",
                marginTop: "3px",
                lineHeight: 1.5,
              }}
            >
              Convierte una lección en standard / regla / skill — eso cambia cómo se construye TODO,
              así que siempre pasa por tu visto bueno.
            </div>
          </div>
        </div>
      </Panel>

      <DocH title="La captura es general y automática" />
      <p
        style={{
          fontSize: "13px",
          color: "var(--color-text2)",
          margin: "0 0 10px",
          lineHeight: 1.6,
        }}
      >
        No depende de construir software: en{" "}
        <B weight={600}>cualquier skill o incluso conversando</B>, si aparece algo durable (un
        arreglo, un veredicto, un truco) se apunta solo a una bandeja. Una regla en{" "}
        <Code>.pandacorp/guide.md</Code> y en el <Code>CLAUDE.md</Code> de la fábrica lo dispara;
        luego el cronista lo pule. Tres niveles:
      </p>
      <Panel>
        <ChipFlow>
          <Chip tone="accent">1 · Capturar (siempre)</Chip>
          {RIGHT_ARROW}
          <Chip tone="accent">2 · Refinar (cronista)</Chip>
          {RIGHT_ARROW}
          <Chip tone="ok">3 · Consolidar (a regla, con tu ok)</Chip>
        </ChipFlow>
      </Panel>

      <DocH title="Las protecciones · por qué no se llena de basura ni se envenena" />
      <Panel>
        <Ul>
          <li>
            <B weight={500}>Dedup A.U.D.N.:</B> cada nota se resuelve en AÑADIR / ACTUALIZAR /
            FUSIONAR / IGNORAR — capturar mucho no engorda el cuaderno.
          </li>
          <li>
            <B weight={500}>Procedencia:</B> cada lección marca quién la dijo (tú &gt; verificado
            por CI &gt; el agente). Lo que infirió el agente necesita corroborarse antes de valer.
          </li>
          <li>
            <B weight={500}>Candidata → activa:</B> nace como candidata y solo se da por buena si se
            corrobora (vista ≥2 veces o confirmada por un resultado real).
          </li>
          <li>
            <B weight={500}>Gate humano:</B> convertir una lección en regla siempre es tu decisión.
          </li>
        </Ul>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)" }}>
          <i
            className="ti ti-alert-triangle"
            aria-hidden="true"
            style={{ fontSize: "13px", verticalAlign: "-2px", color: "var(--color-warn)" }}
          />{" "}
          Lección del research: <B weight={500}>capturar de más no es mejor</B> — un agente que se
          fía de sus propias reflexiones envenena la memoria. Por eso solo se capturan notas
          ancladas a evidencia, nunca opiniones.
        </div>
      </Panel>

      <DocH title="La cola de promociones · decides cuando quieras" />
      <p
        style={{
          fontSize: "13px",
          color: "var(--color-text2)",
          margin: "0 0 10px",
          lineHeight: 1.6,
        }}
      >
        Cuando <Code>review</Code> cree que una lección merece ser regla, la marca{" "}
        <Code>promotion: proposed</Code> — queda guardada en su propio archivo, no en la
        conversación. La revisas con <Code>/pandacorp:memory status</Code> (la lista completa) el
        día que quieras, sin presión. Apruebas → <Code>/learn</Code> la asciende; rechazas → sigue
        siendo lección útil, solo que no regla.
      </p>
      <Panel>
        <ChipFlow>
          <Chip tone="secondary">proposed</Chip>
          {RIGHT_ARROW}
          <Chip tone="warn">tú revisas · status</Chip>
          {RIGHT_ARROW}
          <Chip tone="ok">approved</Chip>
          <span style={{ color: "var(--color-text3)" }}>o</span>
          <Chip tone="secondary">rejected</Chip>
        </ChipFlow>
      </Panel>

      <DocH title="Tipos de lección" />
      <Panel>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            "problema → solución",
            "veredicto de librería",
            "patrón",
            "truco (gotcha)",
            "anti-patrón",
          ].map((t) => (
            <Chip key={t} tone="secondary">
              {t}
            </Chip>
          ))}
        </div>
      </Panel>
      <NotePanel icon="ti-eye" iconColor="var(--color-accent)">
        <B weight={500}>Dónde lo ves:</B> hoy con <Code>/pandacorp:memory status</Code>; mañana, en
        el <B weight={500}>buzón de Propuestas</B> de Mission Control (FRD-17), que mostrará la cola
        de ascensos, las autosugerencias de la app y un recordatorio de cuándo correr memory.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Registry: slug → render function
// ---------------------------------------------------------------------------

/**
 * Map of Manual page slug → React renderer. Keys are the authored content slugs
 * (content/manual/<group>/<slug>.md). A slug absent here falls back to the
 * markdown reader in DocReader.
 */
const MANUAL_PAGE_COMPONENTS: Record<string, () => React.JSX.Element> = {
  // Tutorial
  bienvenida: ManualLanding,
  "como-empezar": ManualQuickstart,
  // Guides (prototype's 7)
  "g-capturar": GuideCapturar,
  "g-handoff": GuideHandoff,
  "g-modo": GuideModo,
  "g-feedback": GuideFeedback,
  "g-probar": GuideProbar,
  "g-traspaso": GuideTraspaso,
  "g-plugin": GuidePlugin,
  // Concepts
  "que-es-pandacorp": ConceptQueEs,
  "el-pipeline": ConceptPipeline,
  "el-equipo": ConceptEquipo,
  "estandares-y-reglas": ConceptEstandares,
  "arquitectura-del-sistema": ConceptArquitectura,
  "mission-control-por-dentro": ConceptCockpit,
  "estado-y-archivos": ConceptEstado,
  "hooks-gates-seguridad": ConceptHooks,
  "stacks-golden-paths": ConceptStacks,
  "construccion-desatendida": ConceptDesatendida,
  "el-plugin": ConceptPlugin,
  autoaprendizaje: ConceptAutoaprendizaje,
};

/**
 * Resolve a Manual page renderer by slug, or null when none is registered
 * (the caller then falls back to the markdown reader).
 */
export function getManualPageComponent(slug: string): (() => React.JSX.Element) | null {
  return MANUAL_PAGE_COMPONENTS[slug] ?? null;
}

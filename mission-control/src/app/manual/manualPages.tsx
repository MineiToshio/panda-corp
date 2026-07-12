"use client";
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
import { DownArrow, IconRow } from "@/components/modules/manual-diagrams/atoms";
import { ChannelsDiagram } from "@/components/modules/manual-diagrams/ChannelsDiagram";
import { CockpitDataDiagram } from "@/components/modules/manual-diagrams/CockpitDataDiagram";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { FlowGraph } from "@/components/modules/manual-diagrams/FlowGraph";
import { HooksDiagram } from "@/components/modules/manual-diagrams/HooksDiagram";
import { ModificationGuide } from "@/components/modules/manual-diagrams/ModificationGuide";
import { MultiRuntimeDiagram } from "@/components/modules/manual-diagrams/MultiRuntimeDiagram";
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
import { RuntimeComparison } from "@/components/modules/manual-diagrams/RuntimeComparison";
import { SelfLearningLoop } from "@/components/modules/manual-diagrams/SelfLearningLoop";
import { SnapshotMini } from "@/components/modules/manual-diagrams/SnapshotMini";
import { SourceOfTruthMap } from "@/components/modules/manual-diagrams/SourceOfTruthMap";
import { StacksTable } from "@/components/modules/manual-diagrams/StacksTable";
import { StateTable } from "@/components/modules/manual-diagrams/StateTable";
import { TeamDiagram } from "@/components/modules/manual-diagrams/TeamDiagram";
import { VaultDiagram } from "@/components/modules/manual-diagrams/VaultDiagram";
import { WorkflowShapeDiagram } from "@/components/modules/manual-diagrams/WorkflowShapeDiagram";
import { backlogFlow, buildFlow } from "@/lib/manual/workflow-flows";
import { useManualNav } from "./ManualNavContext";

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
        La puerta única para pedir un cambio es <Code>/pandacorp:change</Code> (ver{" "}
        <B weight={600}>Cómo pedir un cambio</B>); por dentro, esos cambios se atienden por estos{" "}
        <B weight={600}>tres canales</B>, todos por archivos, que el agente revisa en su próximo
        punto seguro, sin que tengas que pararlo.
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
      intro="El punto seguro es un commit de git, no un estado del agente. Puedes probar la última versión verificada mientras el agente sigue construyendo en su carpeta."
      steps={[
        "Mission Control te muestra la «última versión verificada · segura para probar» (el último commit del build que pasó todos los gates) en Portfolio → Resumen.",
        <>
          Copia el comando del snapshot: crea un <Code>git worktree</Code> apuntando a ese commit en
          la carpeta de revisión dedicada (
          <Code>/Users/Shared/review-worktrees/&lt;proyecto&gt;</Code>, fuera de{" "}
          <Code>Proyectos/</Code> — DR-090).
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
        El know-how de cómo se construye se inyecta en cada proyecto. Son <B weight={600}>27</B>{" "}
        estándares en <B weight={600}>9 dominios</B> — desde convenciones y arquitectura hasta
        manejo de errores, resiliencia, auth, modelado de datos, disciplina de implementación con IA
        y las convenciones de prompting de la propia fábrica (DR-114: la forma se recalibra para los
        modelos en uso, el contenido se verifica, la gobernanza es intocable). Cada uno sigue la{" "}
        <B weight={600}>plantilla ejecutable</B>: Regla + «cómo se verifica» con su check NOMBRADO +
        por qué. Y las <B weight={600}>reglas de decisión</B> son los defaults pre-aprobados para
        que la IA no te pregunte cada vez. Todo el detalle en{" "}
        <B weight={600}>Referencia → Estándares</B> y <B weight={600}>Reglas de decisión</B>.
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
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.6 }}>
          <B weight={500}>El registro de reglas</B> (<Code>rule-registry.md</Code>) indexa las ~131
          reglas con su estado real de enforcement: <Chip tone="ok">wired</Chip> un script/gate la
          verifica solo · <Chip tone="warn">manual</Chip> un paso humano NOMBRADO ·{" "}
          <Chip tone="danger">aspirational</Chip> nada la verifica (un MUST aspiracional es un
          defecto — hoy hay <B weight={600}>cero</B>). <Code>check-standards.sh</Code> valida la
          plantilla y avisa si reaparece uno.
        </div>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.6 }}>
          <B weight={500}>Fuente única de verdad (DR-115, 2026-07-05):</B> cada hecho (un conteo, un
          estado, un nivel) tiene <B weight={600}>un solo escritor</B>; todo lo demás{" "}
          <B weight={600}>deriva</B> a través de un único resolver — nunca duplica. Un valor
          derivado solo puede almacenarse como <B weight={600}>cache honesto</B> (escritor único
          nombrado + re-derivación en puntos seguros + documentado como réplica), y ninguna
          superficie de display lo lee si existe un resolver vivo. Una segunda derivación
          independiente del mismo hecho es un defecto que el reviewer rechaza. Canónico:{" "}
          <Code>single-source-of-truth.md</Code>.
        </div>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.6 }}>
          <B weight={500}>
            Consistencia documental — el gate de supersesión completa (DR-116, 2026-07-05):
          </B>{" "}
          ninguna regla puede sobrevivir en las sombras. Si cambias una regla en un doc pero su
          enunciado viejo sigue vivo en otro, dos agentes leen dos verdades y se desvían — el patrón
          raíz de las ~21 contradicciones que encontró la auditoría (el motor construyó DOS cambios
          cuando pediste UNO). El gate <B weight={600}>nunca bloquea el cambio</B>, solo su
          propagación INCOMPLETA. Dos casos: un <B weight={600}>set recién generado</B> (PRD+FRDs de{" "}
          <Code>spec</Code>, blueprint+WOs de <Code>architecture</Code>) lo revisa un verificador
          FRESCO — una contradicción interna dura <B weight={600}>bloquea el cierre de la fase</B>{" "}
          (como un <Code>[NEEDS CLARIFICATION]</Code> pendiente); una{" "}
          <B weight={600}>edición al corpus existente</B> (<Code>change</Code>/<Code>iterate</Code>/
          <Code>learn</Code>) exige que la supersesión sea COMPLETA — declaras qué regla vieja
          reemplazas y el verificador confirma que ningún doc la sigue afirmando y que el porqué
          quedó registrado (las dos escrituras). Un <B weight={500}>barrido advisory semanal</B>{" "}
          caza la deriva que se cuele — reporta y ficha como <Code>BL-*</Code>, nunca edita ni
          bloquea. Canónico: <Code>document-consistency.md</Code>.
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
      <DocH title="Blindaje del estado sin historia git (BL-0035)" />
      <Lead>
        La capa gitignored (<Code>.pandacorp/inbox</Code>, <Code>comms</Code>, ideas, perfil,
        portfolio, ledgers) no tiene historia git por diseño: un borrado ahí es pérdida permanente.
        Tras el incidente de 2026-07-04 tiene doble blindaje:
      </Lead>
      <NotePanel icon="ti-database-export" iconColor="var(--color-accent)">
        <B weight={600}>Backup automático en cada SessionStart</B> a{" "}
        <Code>pandacorp-vault/backups/</Code> (una carpeta por día, 30 días de retención). Es{" "}
        <B weight={500}>aditivo dentro del día</B> — un borrado parcial en el origen nunca encoge el
        snapshot — y emite una línea-resumen visible (nº de ficheros + fallos), para que un backup
        roto no se disfrace de backup sano. Dónde vive todo este estado personal y cómo restaurarlo
        en una máquina nueva: ver <B weight={500}>«El vault · tu estado personal»</B>.
      </NotePanel>
      <NotePanel icon="ti-shield-lock" iconColor="var(--color-warn)">
        <B weight={600}>Rutas protegidas en el gate de comandos.</B> <Code>block-dangerous.sh</Code>{" "}
        bloquea el borrado recursivo que ALCANCE una ruta protegida — también el borrado del{" "}
        <B weight={500}>directorio padre</B> (<Code>rm -rf mi-app</Code> contiene su{" "}
        <Code>.pandacorp</Code> sin nombrarlo), el flag al final (<Code>rm ruta -r</Code>) y{" "}
        <Code>find … -delete</Code> — y es fail-closed si su propio parser (jq) falta. Probado por
        una matriz canary de 36 casos (<Code>test-block-dangerous.sh</Code>).
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: El vault · tu estado personal
// ---------------------------------------------------------------------------

/** What lives inside the pandacorp-vault sibling folder. */
const VAULT_CONTENTS: readonly {
  readonly name: string;
  readonly what: React.ReactNode;
}[] = [
  {
    name: "personal.git/",
    what: (
      <>
        el <B weight={600}>overlay</B>: un repo git <i>bare</i> que versiona SOLO tus archivos
        personales (ideas, perfil, portfolio, ports, ledger, memoria). Tiene remoto privado en
        GitHub y se auto-commitea y sube en cada arranque de sesión.
      </>
    ),
  },
  {
    name: "backups/",
    what: (
      <>
        los <B weight={600}>respaldos diarios</B> de toda la capa gitignoreada (una carpeta por día,
        30 días de retención). Escritos automáticamente en cada arranque de sesión.
      </>
    ),
  },
  {
    name: "README.md",
    what: "una nota que describe qué es la carpeta, por si la encuentras suelta un día.",
  },
] as const;

/** The 5-step new-machine restore drill (mirrors infra.md). */
const RESTORE_STEPS: readonly {
  readonly key: string;
  readonly title: React.ReactNode;
  readonly body: React.ReactNode;
  readonly cmd?: string;
}[] = [
  {
    key: "toolchain",
    title: "El toolchain",
    body: (
      <>
        Instala el runtime (fnm + node, pnpm), Claude Code y el plugin <Code>pandacorp</Code>. Sin
        esto no arranca nada.
      </>
    ),
  },
  {
    key: "factory-repo",
    title: "El repo de la fábrica",
    body: (
      <>
        Clona <Code>panda-corp</Code> (código y framework). Ojo: los archivos personales están
        gitignoreados, así que <B weight={600}>vuelven vacíos</B> aquí — los rellena el paso 3.
      </>
    ),
    cmd: "git clone <panda-corp> ~/Proyectos/panda-corp",
  },
  {
    key: "vault-overlay",
    title: "El overlay del vault",
    body: (
      <>
        Clona el repo privado como repo <i>bare</i> y hazle <Code>checkout</Code> sobre el árbol de
        la fábrica: tus archivos personales <B weight={600}>reaparecen en su sitio</B>.
      </>
    ),
    cmd: "git clone --bare <vault> pandacorp-vault/personal.git && git --git-dir=…/personal.git --work-tree=…/panda-corp checkout",
  },
  {
    key: "sibling-projects",
    title: "Cada proyecto hermano",
    body: (
      <>
        Clona el repo propio de cada producto. Su estado de propietario en <Code>.pandacorp/</Code>{" "}
        (inbox, comms) se recupera restaurando <Code>backups/</Code> desde la nube y copiándolo de
        vuelta a cada proyecto.
      </>
    ),
  },
  {
    key: "deps-deploy-key",
    title: "Deps, deploy y la llave",
    body: (
      <>
        <Code>pnpm install</Code>; re-lanza el deploy local (<Code>deploy-local.sh</Code> /
        launchd); y restaura la llave <Code>age</Code> en <Code>~/.config/pandacorp/</Code> desde tu
        gestor de contraseñas (no está en ningún repo ni en el vault, a propósito).
      </>
    ),
  },
] as const;

function ConceptVault(): React.JSX.Element {
  return (
    <>
      <DocH title="El vault · tu estado personal" level={1} />
      <Lead>
        Tus ideas, tu perfil, tu portfolio no viven en el repo — son personales y están{" "}
        <B weight={600}>gitignoreados</B>. ¿Dónde viven entonces, y cómo no perderlos? En una
        carpeta hermana: el <B weight={600}>vault</B>.
      </Lead>

      <DocH title="El vault: una carpeta hermana" />
      <Body>
        <Code>pandacorp-vault/</Code> es una carpeta que vive <B weight={600}>al lado</B> de{" "}
        <Code>panda-corp/</Code>, dentro de <Code>Proyectos/</Code>. Guarda todo el estado personal
        y local de la máquina que no puede vivir dentro del repo. Dentro hay tres cosas:
      </Body>
      <Panel>
        {VAULT_CONTENTS.map((row, i) => (
          <KvRow key={row.name} label={<Code>{row.name}</Code>} isFirst={i === 0}>
            {row.what}
          </KvRow>
        ))}
      </Panel>
      <NotePanel icon="ti-info-circle" iconColor="var(--color-info)">
        <B weight={600}>¿Por qué al lado y no fuera, como los deployments?</B> La regla de «mantener
        cosas fuera de <Code>Proyectos/</Code>» existe para que una herramienta no confunda un{" "}
        <B weight={500}>servidor que corre</B> (un deployment) con código fuente — es sobre cosas
        que <i>se ejecutan</i>. El vault no ejecuta nada (git estático + respaldos), así que se
        queda junto al código para que lo encuentres fácil. Lo que sí corre —{" "}
        <Code>local-deployments/</Code> — se queda fuera.
      </NotePanel>

      <DocH title="Una carpeta, dos repos" />
      <Lead>
        El modelo mental clave: es <B weight={600}>una sola carpeta en disco</B>, con{" "}
        <B weight={600}>dos repos git</B> que trackean conjuntos de archivos{" "}
        <B weight={600}>distintos</B>. Ningún archivo está en los dos.
      </Lead>
      <Panel>
        <div style={{ overflowX: "auto" }}>
          <VaultDiagram />
        </div>
      </Panel>
      <Body margin="12px 0 12px">
        La analogía que funciona:{" "}
        <B weight={600}>
          dos bibliotecarios catalogando estanterías distintas de la MISMA biblioteca
        </B>
        . Los libros nunca se mueven, y no hay una segunda biblioteca. El <i>work-tree</i> del
        overlay <B weight={600}>no es una copia</B> de <Code>panda-corp/</Code>: ambos repos «miran»
        la misma carpeta. Por eso el <Code>.git</Code> del overlay es diminuto (~232 KB, solo la
        historia de unos archivos de texto), no un duplicado del proyecto.
      </Body>
      <NotePanel icon="ti-check" iconColor="var(--color-ok)">
        <B weight={600}>No es una segunda fuente de verdad.</B> Cada archivo tiene exactamente una
        copia física y un repo que lo trackea (conjuntos disjuntos) → cero duplicación, cero deriva.
        Es la misma ley de fuente única de verdad (DR-115) que rige el resto de la fábrica, aplicada
        al almacenamiento.
      </NotePanel>

      <DocH title="Dos tipos de pérdida, dos protecciones" />
      <Body>
        Hay dos formas de perder tu trabajo, y cada una tiene su red de seguridad. No son
        intercambiables:
      </Body>
      <NotePanel icon="ti-history" iconColor="var(--color-accent)">
        <B weight={600}>Los backups → contra un borrado accidental.</B> Si alguien barre o borra una
        carpeta <Code>.pandacorp/</Code> del estado gitignoreado, el snapshot del día lo deshace.
        Cubren <B weight={500}>TODO</B>: el estado de propietario de cada proyecto (inbox/comms){" "}
        <B weight={500}>y</B> los archivos personales de la fábrica. Pero son{" "}
        <B weight={600}>locales</B> (viven en el vault) → no te salvan si pierdes el portátil.
      </NotePanel>
      <NotePanel icon="ti-cloud-lock" iconColor="var(--color-warn)">
        <B weight={600}>El remoto privado del overlay → contra la pérdida del portátil.</B> Los
        datos personales de la fábrica (ideas, perfil) están <B weight={500}>offsite</B> en un
        GitHub privado. Si el disco muere, tus ideas siguen ahí.
      </NotePanel>
      <NotePanel icon="ti-alert-triangle" iconColor="var(--color-warn)">
        <B weight={600}>Pendiente (recuperación ante desastre real):</B> hoy los backups son SOLO
        locales. Para sobrevivir a la pérdida del equipo necesitan una{" "}
        <B weight={600}>copia en la nube</B> — mientras no la haya, solo el overlay está a salvo
        offsite, no el estado de los proyectos hermanos.
      </NotePanel>

      <DocH title="Traer todo a una máquina nueva" />
      <Lead>
        El estado completo vive en unas pocas fuentes disjuntas. Para reconstruir la fábrica desde
        cero, en orden:
      </Lead>
      {RESTORE_STEPS.map((step, i) => (
        <QuickStep key={step.key} n={i + 1} title={step.title} body={step.body} cmd={step.cmd} />
      ))}
      <NotePanel icon="ti-cloud" iconColor="var(--color-accent-text)">
        Las <B weight={600}>dos fuentes que deben estar vivas FUERA del equipo</B> para que esto
        funcione: el <B weight={500}>remoto privado del overlay</B> (paso 3) y una{" "}
        <B weight={500}>copia offsite de los backups</B> (paso 4). El vault en disco es local — y
        muere con el disco.
      </NotePanel>

      <DocH title="Y las llaves, ¿dónde?" />
      <NotePanel icon="ti-key" iconColor="var(--color-warn)">
        <B weight={600}>Los secretos NO van en el vault.</B> La llave <Code>age</Code> de SOPS vive
        en <Code>~/.config/pandacorp/</Code> — tu carpeta de usuario, privada — por dos razones:{" "}
        <Code>/Users/Shared/</Code> es multi-usuario en macOS (lugar equivocado para una llave
        privada), y <Code>~/.config/</Code> es donde las herramientas la buscan por defecto (XDG).
        Se restaura desde tu gestor de contraseñas, nunca desde un repo.
      </NotePanel>
    </>
  );
}

function ConceptStacks(): React.JSX.Element {
  return (
    <>
      <DocH title="Stacks · golden paths" level={1} />
      <Lead>
        3 golden paths documentados (el viejo D —scraping— se plegó en C: era el mismo stack) más
        una lista de <B weight={600}>puntos de partida</B> para casos nuevos. El{" "}
        <B weight={600}>architect</B> elige el que encaja (lo apruebas en el blueprint) y puede
        proponer algo mejor con trade-offs. Son combinables — el caso Funkos = C para recolectar + A
        para mostrar.
      </Lead>
      <StacksTable />
    </>
  );
}

function ConceptDesatendida(): React.JSX.Element {
  const nav = useManualNav();
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
              <B weight={500}>Repara antes de bloquear</B>: si un WO o el gate de revisión falla, el
              motor sube una escalera — diagnostica primero (puntual · arquitectónico ·
              gate-test-defectuoso · punto muerto), parchea informado, y si no converge revierte
              solo la costura tocada. Cada paso queda en un diario durable (
              <Code>build-journal.jsonl</Code>). Solo si de verdad necesita al owner marca BLOCKED
              con motivo (needs-owner | external | error) y sigue con features independientes.
            </li>
            <li>
              <B weight={500}>Frenos de salud/presupuesto</B>: tope de presupuesto, demasiados
              bloqueos seguidos (freno de salud), nada que construir. No hay freeze-on-red directo.
            </li>
            <li>
              <B weight={500}>Punto seguro = commit por FRD:</B> el gate escribe{" "}
              <Code>last_green_sha</Code> y <Code>safe_to_test</Code> mediante dos commits: primero
              el snapshot verificado y luego un commit solo de metadatos que apunta a ese ancestro.
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
      <NotePanel icon="ti-route" iconColor="var(--color-accent)">
        El mecanismo del motor (oleadas globales, gate en abanico, supervisor) está detallado en{" "}
        <button
          type="button"
          onClick={() => nav.goToManual("workflows", "wf-pandacorp-build")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            font: "inherit",
            color: "var(--color-accent-text)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Dynamic Workflows → pandacorp-build
        </button>
        .
      </NotePanel>
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
                y propone ascensos · <B weight={500}>status</B> te muestra la cola. Desde el loop v2
                ya no lo corres tú: el cierre de cada build y la rutina diaria lo invocan solos.
                Nunca asciende nada por sí solo.
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
        arreglo, un veredicto, un truco) se apunta solo a una bandeja —{" "}
        <B weight={600}>en el mismo turno en que ocurre</B>, nunca "al final de la sesión" (loop v2:
        diferir la captura es perderla). Una regla en <Code>.pandacorp/guide.md</Code> y en el{" "}
        <Code>CLAUDE.md</Code> de la fábrica lo dispara; un hook de cierre re-escanea la
        conversación como red de seguridad por si algo se escapó; luego el cronista lo pule. Tres
        niveles:
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
            <B weight={500}>Candidata → activa:</B> nace como candidata y solo se da por buena con
            corroboración <B weight={500}>cruzada</B> (loop v2): la confirma un proyecto DISTINTO
            del que la produjo, o la dijiste tú / la verificó un script. Una lección auto-inferida
            de una sola experiencia jamás se auto-activa.
          </li>
          <li>
            <B weight={500}>Uso medido, no prometido:</B> los agentes citan la lección (LESSON-NNNN)
            en el documento que escriben y un script cuenta esas citas — los contadores nunca se
            editan a mano. La poda por "nunca usada" está congelada hasta que haya medición real de
            ≥3 proyectos.
          </li>
          <li>
            <B weight={500}>Gate humano:</B> convertir una lección en regla siempre es tu decisión
            (con una sola excepción acotada: un estándar suave que llega con su verificador
            automático puede aplicarse solo, avisándote).
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
          ancladas a evidencia, nunca opiniones. Desde 2026-07-09 esto es una regla dura con
          verificador: el <Code>source:</Code> de una lección debe citar un localizador comprobable
          (una fecha, un id, un fichero, un commit, una URL) o <Code>validate-memory.sh</Code> pone
          la memoria en rojo.
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
        Cuando <Code>review</Code> cree que una lección merece ser regla — o cuando{" "}
        <B weight={600}>3 proyectos la citaron</B> (el escalador automático del loop v2) — se marca{" "}
        <Code>promotion: proposed</Code> y queda guardada en su propio archivo, no en la
        conversación. La ves en el <B weight={500}>buzón de Propuestas</B> de Mission Control o en
        el reporte de la rutina diaria, el día que quieras, sin presión. Apruebas →{" "}
        <Code>/learn</Code> la asciende; rechazas → sigue siendo lección útil, solo que no regla.
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
        <B weight={500}>Dónde lo ves:</B> en el <B weight={500}>buzón de Propuestas</B> de Mission
        Control (FRD-17): la cola de ascensos con su comando listo para copiar, las autosugerencias
        de la app y el panel de salud de la memoria (notas pendientes, último barrido diario y
        builds que cerraron sin cosechar). <Code>/pandacorp:memory status</Code> sigue disponible si
        prefieres la terminal.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers for the audit-gap concept pages
// ---------------------------------------------------------------------------

/** A two-column "key → value" row inside a Panel (label left, content right). */
function KvRow({
  label,
  isFirst,
  children,
}: {
  label: React.ReactNode;
  isFirst: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "baseline",
        padding: "7px 0",
        borderTop: isFirst ? undefined : "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          flex: "0 0 132px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "13px",
          color: "var(--color-text2)",
          lineHeight: 1.55,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A labelled chip + description row (e.g. a return_type or a verdict). */
function ChipDefRow({
  chip,
  tone,
  isFirst,
  children,
}: {
  chip: string;
  tone: "info" | "ok" | "warn" | "danger" | "accent" | "secondary";
  isFirst: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        padding: "8px 0",
        borderTop: isFirst ? undefined : "1px solid var(--color-border)",
      }}
    >
      <div style={{ flex: "0 0 116px" }}>
        <Chip tone={tone}>{chip}</Chip>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "13px",
          color: "var(--color-text2)",
          lineHeight: 1.55,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A small "step n + body" trail node with a down-arrow connector. */
function NumberedTrail({
  steps,
}: {
  steps: readonly { title: React.ReactNode; body: React.ReactNode }[];
}): React.JSX.Element {
  return (
    <div>
      {steps.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static authored ordered trail
        <div key={i}>
          <Panel variant="rpgpanel">
            <div style={{ display: "flex", gap: "11px", alignItems: "flex-start" }}>
              <ItemSlot
                size={28}
                tone="accent"
                aria-label={`Paso ${i + 1}`}
                icon={
                  <span
                    style={{
                      fontFamily: "var(--font-pixel, monospace)",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                }
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-text)" }}>
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--color-text2)",
                    lineHeight: 1.55,
                    marginTop: "3px",
                  }}
                >
                  {s.body}
                </div>
              </div>
            </div>
          </Panel>
          {i < steps.length - 1 && <DownArrow marginLeft="14px" />}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: El arco económico
// ---------------------------------------------------------------------------

function ConceptArcoEconomico(): React.JSX.Element {
  return (
    <>
      <DocH title="El arco económico" level={1} />
      <Lead>
        No todas las ideas se construyen igual. El pipeline{" "}
        <B weight={600}>
          se bifurca según el <Code>return_type</Code>
        </B>{" "}
        de la idea y adapta lo que hace en cada fase: no es un pipeline único con forma de «app que
        cobra» — lee el tipo de retorno y se ajusta (DR-042).
      </Lead>

      <DocH title="Los cuatro tipos de retorno" />
      <Panel>
        <ChipDefRow chip="personal" tone="info" isFirst>
          El usuario eres tú. Se salta investigación de mercado/competencia, validación de demanda,
          precio y GTM; el foco es resolver bien tu necesidad.
        </ChipDefRow>
        <ChipDefRow chip="monetary" tone="ok" isFirst={false}>
          App pensada para generar ingresos. Tratamiento completo: gate de demanda, unit-economics y
          plan de distribución.
        </ChipDefRow>
        <ChipDefRow chip="mixed" tone="accent" isFirst={false}>
          Útil para ti y monetizable a la vez. Mismo tratamiento que <Code>monetary</Code>.
        </ChipDefRow>
        <ChipDefRow chip="opportunity" tone="warn" isFirst={false}>
          Apalanca un activo tuyo (audiencia, comunidad, red, posicionamiento). Valida que el
          alcance es real y define una métrica de oportunidad; sin precio salvo que sea{" "}
          <Code>mixed</Code>.
        </ChipDefRow>
      </Panel>

      <DocH title="El gate de demanda · puede matar una idea antes de construir" />
      <Body>
        <Code>/pandacorp:spec</Code> hace una pre-comprobación de demanda{" "}
        <B weight={600}>ANTES de crear la carpeta</B> del proyecto. Para <Code>monetary</Code>/
        <Code>mixed</Code> revisa si hay competidores <B weight={600}>que cobran de verdad</B> (el
        mercado existe y paga), si el dolor es frecuente y, en B2B, quién paga.
      </Body>
      <NotePanel icon="ti-skull" iconColor="var(--color-danger)">
        Si la señal falta o contradice la idea,{" "}
        <B weight={600}>para y recomienda matar/pivotar — NO crea el proyecto</B> (matar aquí no
        deja un repo huérfano). Es la pieza que evita invertir diseño y construcción en una idea
        monetaria sin validar.
      </NotePanel>

      <DocH title="Unit-economics y kill-signals · viven en el PRD" />
      <Panel>
        <Ul>
          <li>
            <B weight={500}>Unit-economics</B> — precio propuesto (anclado a los competidores que
            cobran) + coste variable por usuario activo (Polar ~4%+$0.40, Vercel Pro, tiers de
            Neon/R2/Resend/PostHog) + break-even de servilleta. El blueprint rellena el lado del
            coste.
          </li>
          <li>
            <B weight={500}>Kill-signals</B> — señales de muerte con umbrales numéricos (p. ej.{" "}
            <Code>&lt; N usuarios activos</Code> o <Code>$0 de ingresos a los 60 días</Code> →
            revisión formal). Para <Code>opportunity</Code>, la métrica de oportunidad.
          </li>
        </Ul>
      </Panel>

      <DocH title="La distribución · en release" />
      <Body>
        <Code>/pandacorp:release</Code> es consciente del retorno: para <Code>monetary</Code>/
        <Code>mixed</Code>/<Code>opportunity</Code> produce además <Code>docs/launch-plan.md</Code>{" "}
        — el canal de adquisición principal + 3-5 borradores de posts para que tú publiques, bajo el
        gate de comunicaciones externas (DR-008). Para <Code>personal</Code>, se salta.
      </Body>
      <NotePanel icon="ti-rocket" iconColor="var(--color-accent-text)">
        <B weight={600}>Desplegado ≠ lanzado:</B> una app sin usuarios no genera nada. El cierre del
        arco lo hace <Code>review-launch</Code> (kill / hold / double-down) — ver{" "}
        <B weight={600}>Después de lanzar</B>.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: Después de lanzar
// ---------------------------------------------------------------------------

function ConceptDespuesDeLanzar(): React.JSX.Element {
  return (
    <>
      <DocH title="Después de lanzar" level={1} />
      <Lead>
        <B weight={600}>Desplegado ≠ lanzado.</B> Que una versión esté desplegada no significa que
        tenga usuarios ni que funcione el negocio. El ciclo de vida no termina en el deploy:{" "}
        <Code>release</Code> es la fase en la que la idea <B weight={600}>YA está lanzada</B> — y
        desde ahí se itera. No hay una fase «operación» aparte: operar (leer métricas y decidir) es
        lo que haces estando ya en <Code>release</Code>.
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
          Las 6 fases (termina en release)
        </div>
        <ChipFlow>
          <Chip tone="secondary">investigación</Chip>
          {RIGHT_ARROW}
          <Chip tone="secondary">product</Chip>
          {RIGHT_ARROW}
          <Chip tone="secondary">design</Chip>
          {RIGHT_ARROW}
          <Chip tone="secondary">architecture</Chip>
          {RIGHT_ARROW}
          <Chip tone="secondary">implementation</Chip>
          {RIGHT_ARROW}
          <Chip tone="ok">release</Chip>
        </ChipFlow>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.6 }}>
          La <B weight={500}>auditoría —seguridad, calidad y métricas/telemetría—</B> es el{" "}
          <B weight={500}>último paso de la construcción</B> (<Code>implementation</Code>), no del
          release. Cuando una versión llega a <Code>release</Code> ya está endurecida y desplegada;{" "}
          <Code>release</Code> significa «ya está lanzado», y desde ahí iteras.
        </div>
      </Panel>

      <DocH title="Interno vs externo · el mismo release" />
      <Lead>
        La distinción real no es lanzar-vs-operar, sino <B weight={600}>dónde se despliega</B> (el
        campo <Code>deploy_target</Code>). Es el mismo concepto —un release de un producto de
        software—; solo cambia el destino.
      </Lead>
      <Panel>
        <ChipDefRow chip="internal" tone="info" isFirst>
          Herramienta interna: vive sin servidor externo (como el propio Mission Control en{" "}
          <Code>127.0.0.1</Code>). <Code>/pandacorp:release</Code> aquí significa correrla en local
          — sin deploy a la nube ni gate de producción.
        </ChipDefRow>
        <ChipDefRow chip="external" tone="ok" isFirst={false}>
          Producto desplegado fuera (Vercel, AWS, etc.), con su gate humano de producción. Mismo
          ciclo: una vez lanzado, estás en <Code>release</Code> e iteras.
        </ChipDefRow>
      </Panel>

      <DocH title="review-launch · cierra el bucle (DR-043)" />
      <Lead>
        <Code>/pandacorp:review-launch</Code> es la <B weight={600}>iteración post-lanzamiento</B>:
        corre en un proyecto ya lanzado (precondición <Code>phase: release</Code>), no en una fase
        «operación» separada. Lee los objetivos del PRD, las métricas reales en PostHog (
        <Code>docs/analytics/events.md</Code>) según el <Code>return_type</Code>, compara, y
        actualiza las columnas de negocio del portfolio.
      </Lead>
      <NotePanel icon="ti-shield-check" iconColor="var(--color-warn)">
        <B weight={600}>Antes de leer un solo número, dos asertos de procedencia</B> (los datos del
        proyecto equivocado son peores que ningún dato): que exista la telemetría de ESTE proyecto (
        <Code>docs/analytics/events.md</Code> — si falta, se detiene con «sin telemetría:
        instrumenta primero vía <Code>/pandacorp:change</Code>» y NO emite veredicto), y que el
        proyecto de PostHog conectado sea el de esta app (si no coincide o no hay conexión, no lee
        de otra org: deja las consultas escritas para que las corras y reporta «sin datos para este
        proyecto»). Nunca inventa números.
      </NotePanel>
      <Panel>
        <KvRow label="monetary / mixed" isFirst>
          usuarios activos, ingresos/MRR y el chequeo de unit-economics (¿los ingresos cubren el
          coste por usuario + el asiento de Vercel Pro?).
        </KvRow>
        <KvRow label="opportunity" isFirst={false}>
          la métrica de oportunidad (alcance/contactos/posicionamiento ganados).
        </KvRow>
        <KvRow label="personal" isFirst={false}>
          ¿el dueño realmente la usa (una señal mínima de uso)?
        </KvRow>
      </Panel>

      <DocH title="Los tres veredictos" />
      <Panel>
        <ChipDefRow chip="DOUBLE DOWN" tone="ok" isFirst>
          La hipótesis se sostuvo (o va bien): recomienda el siguiente paso (encolar la próxima
          feature por la puerta única <Code>/pandacorp:change</Code>, o empujar la distribución de{" "}
          <Code>docs/launch-plan.md</Code>).
        </ChipDefRow>
        <ChipDefRow chip="HOLD" tone="warn" isFirst={false}>
          No concluyente / demasiado pronto: seguir midiendo; fija la próxima fecha de revisión.
        </ChipDefRow>
        <ChipDefRow chip="KILL / ARCHIVE" tone="danger" isFirst={false}>
          Saltó un kill-signal (monetary: bajo el umbral o CAC &gt; LTV; opportunity: métrica plana;
          personal: el dueño dejó de usarla): recomienda archivar y liberar el foco.
        </ChipDefRow>
      </Panel>

      <NotePanel icon="ti-hand-stop" iconColor="var(--color-warn)">
        <B weight={600}>No mata por su cuenta.</B> review-launch lee, recomienda y solo escribe las
        columnas de negocio + una nota. Matar, archivar, desplegar o gastar siguen siendo{" "}
        <B weight={500}>gates humanos</B>: el bucle produce la recomendación, tú decides. Es
        consciente del retorno — una herramienta <Code>personal</Code> que usas a diario es un éxito
        aunque facture $0.
      </NotePanel>
      <NotePanel icon="ti-layout-dashboard" iconColor="var(--color-accent)">
        Alimenta el portfolio con columnas de negocio —Usuarios / Retorno / Veredicto— para ver
        ganadores vs zombies. Puede correr a demanda o como un job <Code>/loop</Code> autopautado
        sobre el portfolio lanzado: sin nadie presente, solo mide, registra y avisa.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: Servicios, cuentas y secretos
// ---------------------------------------------------------------------------

const SERVICE_STACK: readonly { concern: string; service: string }[] = [
  { concern: "Base de datos (Postgres)", service: "Neon" },
  { concern: "Almacenamiento de ficheros/fotos", service: "Cloudflare R2" },
  { concern: "Correo transaccional", service: "Resend" },
  { concern: "Correo marketing / lista de espera", service: "Kit" },
  { concern: "Errores", service: "Sentry" },
  { concern: "Analítica de producto", service: "PostHog" },
  { concern: "Pagos", service: "Polar" },
] as const;

function ConceptServiciosSecretos(): React.JSX.Element {
  return (
    <>
      <DocH title="Servicios, cuentas y secretos" level={1} />
      <Lead>
        Cuando una app necesita base de datos, correo, pagos o analítica, la fábrica no inventa: usa
        un <B weight={600}>stack de servicios probado</B>, un <B weight={600}>modelo de cuentas</B>{" "}
        que da aislamiento sin pesadilla operativa, y guarda los{" "}
        <B weight={600}>secretos cifrados fuera de todo repo</B>.
      </Lead>

      <DocH title="El stack de servicios (probado)" />
      <Panel>
        {SERVICE_STACK.map((row, i) => (
          <KvRow key={row.service} label={row.concern} isFirst={i === 0}>
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{row.service}</span>
          </KvRow>
        ))}
      </Panel>

      <DocH title="El modelo de cuentas" />
      <Body>
        <B weight={600}>Por defecto: UNA cuenta/org compartida por servicio</B>, separando cada app
        por su <B weight={600}>primitivo nativo</B>. El aislamiento no viene de tener cuentas
        separadas: viene de un proyecto de Neon (= BD física aislada), un bucket de R2, un dominio
        de Resend, una org de PostHog, un producto de Polar — cada uno con su credencial. Basta para
        producción real con datos personales (GDPR).
      </Body>
      <NotePanel icon="ti-shield-check" iconColor="var(--color-ok)">
        <B weight={600}>Regla «free org SÍ, cuenta-títere NO».</B> Usar la separación que el
        proveedor ofrece (orgs de PostHog, proyectos de Neon) es legítimo. Crear varias cuentas con{" "}
        <Code>+alias</Code> para esquivar un tope del free-tier viola los términos de servicio y
        arriesga baneos que tumban apps vivas.
      </NotePanel>

      <DocH title="Los secretos · cifrados, fuera de todo repo" />
      <Panel>
        <Ul>
          <li>
            <B weight={500}>Runtime</B> — en el <Code>.env</Code> del proyecto (gitignored;{" "}
            <Code>.env.example</Code> sin valores).
          </li>
          <li>
            <B weight={500}>Almacén de máquina</B> (lo que el agente lee sin ti presente) →{" "}
            <B weight={500}>SOPS + age</B>: un fichero cifrado{" "}
            <B weight={600}>fuera de cualquier repo</B> (p. ej.{" "}
            <Code>~/.config/pandacorp/secrets/</Code>), con la clave privada <Code>age</Code> en el{" "}
            <B weight={500}>Keychain de macOS</B>. SOPS cifra solo los <i>valores</i>.
          </li>
        </Ul>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)" }}>
          <i
            className="ti ti-lock"
            aria-hidden="true"
            style={{ fontSize: "13px", verticalAlign: "-2px", color: "var(--color-text2)" }}
          />{" "}
          Nunca van secretos al código ni al contexto de los agentes (DR-037).
        </div>
      </Panel>

      <DocH title="Pagos desde Perú · Merchant of Record" />
      <Body>
        El dueño está en <B weight={600}>Perú</B>, donde Stripe directo no opera (requeriría una LLC
        en EE. UU.). Un <B weight={600}>Merchant of Record</B> es el vendedor legal: cobra
        globalmente, gestiona IVA/impuestos y compliance, y <B weight={600}>te paga en Perú</B>. El
        estándar es <B weight={600}>Polar</B> (payout vía Stripe Connect Express, ~4% + $0.40,
        enfocado a developers).
      </Body>

      <DocH title="El aviso de Vercel Pro" />
      <NotePanel icon="ti-alert-triangle" iconColor="var(--color-warn)">
        Vercel Hobby (gratis) es <B weight={500}>no comercial</B>: cualquier cobro, anuncio o
        donación cuenta como comercial. Si una versión cobra, requiere{" "}
        <B weight={500}>Vercel Pro</B> ($20/mes por asiento — un asiento = toda la fábrica).{" "}
        <B weight={500}>No bloquea</B> (no es un gate): la fábrica solo AVISA en 3 momentos —al
        definir el PRD, en el blueprint y en el release (DR-035).
      </NotePanel>

      <DocH title="Push al celular en cada gate" />
      <NotePanel icon="ti-device-mobile-message" iconColor="var(--color-accent-text)">
        En cualquier punto que requiera una decisión/acción tuya (gates DR-004/005/007/008/035,
        pendientes de <Code>decide</Code>, o un signup/2FA/pago durante el aprovisionamiento), el
        agente dispara una notificación push. Llega al celular si Remote Control / la app de Claude
        está conectada, con un mensaje accionable, <B weight={500}>además</B> de dejar el pendiente
        por archivo (DR-038).
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: Los gates humanos
// ---------------------------------------------------------------------------

const HUMAN_GATES: readonly { icon: string; label: React.ReactNode; body: React.ReactNode }[] = [
  { icon: "ti-bulb", label: "Selección de idea", body: "elegir qué idea avanza." },
  { icon: "ti-palette", label: "Elección de diseño", body: "aprobar el diseño visual." },
  {
    icon: "ti-cloud-upload",
    label: "Release a producción",
    body: <>el deploy a producción (DR-004).</>,
  },
  {
    icon: "ti-coin",
    label: "Gastar dinero",
    body: (
      <>
        compras, planes de pago, dominios, APIs de pago. El bloqueo siempre es{" "}
        <B weight={500}>con el monto</B> (DR-005): no hay umbral automático.
      </>
    ),
  },
  {
    icon: "ti-trash",
    label: "Borrar datos o recursos",
    body: <>datos, repos, ramas remotas o recursos cloud (DR-007).</>,
  },
  {
    icon: "ti-mail-forward",
    label: "Comunicaciones externas",
    body: <>emails a usuarios, webhooks públicos, publicar en stores/marketplaces (DR-008).</>,
  },
  {
    icon: "ti-key",
    label: "Cambios de acceso",
    body: "permisos, roles, credenciales.",
  },
] as const;

function ConceptGatesHumanos(): React.JSX.Element {
  return (
    <>
      <DocH title="Los gates humanos" level={1} />
      <Lead>
        La fábrica es autónoma, pero hay decisiones que <B weight={600}>solo tú</B> puedes tomar:
        las que tienen consecuencias irreversibles, cuestan dinero o salen al mundo. Todo lo demás
        lo resuelve el registro de decisiones; una decisión no cubierta se escala UNA vez y se
        codifica como regla.
      </Lead>

      <DocH title="La lista completa" />
      <Panel>
        {HUMAN_GATES.map((g) => (
          <div key={String(g.label)} style={{ marginBottom: "8px" }}>
            <Panel variant="rpgpanel">
              <IconRow icon={g.icon} iconColor="var(--color-accent-text)" title={g.label}>
                {g.body}
              </IconRow>
            </Panel>
          </div>
        ))}
      </Panel>

      <DocH title="Se aplican como reglas duras, no como conversación" />
      <NotePanel icon="ti-lock" iconColor="var(--color-danger)">
        Estos gates se aplican como{" "}
        <B weight={600}>
          reglas <Code>deny</Code> duras
        </B>{" "}
        en <Code>.claude/settings.json</Code> + hooks deterministas, <B weight={600}>nunca</B> como
        límites dichos en la conversación: el contexto puede compactarse y perderse, un hook no.{" "}
        <B weight={500}>«Auto mode» no es una salvaguarda.</B>
      </NotePanel>

      <DocH title="Cada intervención reduce las futuras" />
      <Body>
        La otra mitad del principio:{" "}
        <B weight={600}>toda intervención humana debe reducir las futuras.</B> Cuando te escalan
        algo no cubierto, das tu respuesta y esa respuesta se codifica como regla en el registro. La
        próxima vez que aparezca el mismo caso, ya no te preguntan: el default decide. Así la
        fábrica se vuelve más autónoma con el uso, sin perder el control sobre lo que importa.
      </Body>
      <NotePanel icon="ti-device-mobile-message" iconColor="var(--color-accent)">
        Cada gate dispara además un <B weight={500}>push al celular</B> (DR-038): el pendiente queda
        por archivo y te llega un aviso accionable.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: El espinazo de documentos
// ---------------------------------------------------------------------------

function ConceptEspinazoDocs(): React.JSX.Element {
  return (
    <>
      <DocH title="El espinazo de documentos" level={1} />
      <Lead>
        Cada proyecto se documenta con una cadena de documentos enlazados por IDs estables. No es
        burocracia: es la <B weight={600}>trazabilidad</B> que permite saber, para cada línea de
        código, de qué requisito vino y qué criterio la verifica.
      </Lead>

      <DocH title="Qué es cada documento" />
      <Panel>
        <KvRow label="PRD" isFirst>
          <Code>docs/product/prd.md</Code> — la visión, usuarios, métricas y alcance + una tabla
          VIVA de «feature landscape» (el mapa de FRDs).
        </KvRow>
        <KvRow label="FRD" isFirst={false}>
          <Code>docs/frds/frd-NN-&lt;slug&gt;/frd.md</Code> — el contrato de usuario:{" "}
          <Code>REQ-NN-MMM</Code> + <Code>AC-NN-MMM.K</Code> (EARS, testeable).
        </KvRow>
        <KvRow label="FDD" isFirst={false}>
          <Code>frd-NN-&lt;slug&gt;/fdd.md</Code> — el diseño de la feature. Condicional: solo si
          tiene UI.
        </KvRow>
        <KvRow label="Blueprint" isFirst={false}>
          dos capas: plataforma (<Code>docs/product/architecture.md</Code>, uno por proyecto) y
          feature (<Code>frd-NN-&lt;slug&gt;/blueprint.md</Code>, por FRD). Nunca se fusionan.
        </KvRow>
        <KvRow label="ADR" isFirst={false}>
          <Code>docs/adr/</Code> — decisiones técnicas a nivel de plataforma (cross-feature).
        </KvRow>
        <KvRow label="Work order" isFirst={false}>
          <Code>frd-NN-&lt;slug&gt;/work-orders/wo-NN-MMM-&lt;slug&gt;.md</Code> — una rebanada
          gruesa (una vista/capacidad); copia sus AC en línea.
        </KvRow>
      </Panel>

      <DocH title="La cadena de trazabilidad" />
      <Panel>
        <ChipFlow>
          <Chip tone="accent">REQ-NN-MMM</Chip>
          {RIGHT_ARROW}
          <Chip tone="accent">AC-NN-MMM.K</Chip>
          {RIGHT_ARROW}
          <Chip tone="info">CMP-NN · IF-NN</Chip>
          {RIGHT_ARROW}
          <Chip tone="ok">WO-NN-MMM</Chip>
        </ChipFlow>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.6 }}>
          <Code>REQ</Code> requisito (en <Code>frd.md</Code>) · <Code>AC</Code> criterio de
          aceptación (EARS) · <Code>CMP/IF</Code> componente/interfaz (en <Code>blueprint.md</Code>)
          · <Code>WO</Code> work order, cuyos tests mapean de vuelta a <Code>AC-NN-MMM.K</Code>.
        </div>
      </Panel>

      <DocH title="La jerarquía de fuente de verdad" />
      <Lead>
        Cuando dos documentos se contradicen, <B weight={600}>gana el de arriba</B> y se corrige el
        de abajo. Los cambios propagan upstream en ese orden.
      </Lead>
      <Panel>
        <ChipFlow>
          <Chip tone="accent">FRD</Chip>
          <span style={{ color: "var(--color-text3)" }}>&gt;</span>
          <Chip tone="info">FDD</Chip>
          <span style={{ color: "var(--color-text3)" }}>&gt;</span>
          <Chip tone="info">design-tokens</Chip>
          <span style={{ color: "var(--color-text3)" }}>&gt;</span>
          <Chip tone="secondary">blueprint</Chip>
          <span style={{ color: "var(--color-text3)" }}>&gt;</span>
          <Chip tone="secondary">work order</Chip>
        </ChipFlow>
      </Panel>

      <DocH title="La disciplina de las dos escrituras" />
      <Panel>
        <Body size="13px" margin="0 0 8px">
          Documentar un cambio son <B weight={600}>dos cosas, siempre</B>:
        </Body>
        <Ul>
          <li>
            <B weight={500}>Actualizar el documento canónico</B> (la verdad de ahora) — el que{" "}
            <i>posee</i> ese hecho.
          </li>
          <li>
            <B weight={500}>Registrar la decisión</B> en <Code>docs/decision-log.md</Code> (la
            historia) — fecha, qué, por qué, enlazando el documento tocado.
          </li>
        </Ul>
        <Divider />
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.6 }}>
          El canónico responde «¿qué es verdad ahora?»; el log, «¿cómo llegamos aquí y por qué?».
          Hacen falta los dos: el FRD solo pierde el porqué; el log solo deja el FRD mintiendo. Un
          cambio de comportamiento <B weight={500}>no está hecho</B> sin su FRD actualizado{" "}
          <B weight={500}>y</B> su entrada de decision-log.
        </div>
      </Panel>
      <NotePanel icon="ti-folders" iconColor="var(--color-accent)">
        La estructura es <B weight={500}>feature-céntrica</B> (DR-049): una capa fina de producto +
        un módulo autocontenido por feature. Las carpetas aparecen bajo demanda. El Manual de
        Mission Control refleja esta misma disciplina (DR-046).
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: Tu perfil
// ---------------------------------------------------------------------------

function ConceptTuPerfil(): React.JSX.Element {
  return (
    <>
      <DocH title="Tu perfil · cómo personaliza la fábrica" level={1} />
      <Lead>
        La fábrica se personaliza para ti. Un perfil tuyo —intereses, activos y apetito— hace que
        las ideas que te propone encajen contigo en vez de ser genéricas. Vive en{" "}
        <Code>factory/profile.md</Code> (personal, gitignored).
      </Lead>

      <DocH title="El onboarding lo arranca" />
      <Body>
        <Code>/pandacorp:onboarding</Code> es el primer paso al clonar la fábrica. Te entrevista a
        fondo —nombre, objetivos, intereses, hobbies, gustos, <B weight={600}>activos/palancas</B>,
        apetito de monetización, tipos de proyecto y cómo trabajas— y guarda el perfil en{" "}
        <Code>factory/profile.md</Code>. Puede arrancarlo desde tus conversaciones pasadas. Nunca
        inventa datos: lo que no digas, lo deja vacío.
      </Body>

      <DocH title="Lentes rotativos y dos fases en discover" />
      <Lead>
        <Code>/pandacorp:discover</Code> no busca a ciegas ni te entrega memos que no pediste: caza
        con 2-3 lentes rotativos y tu gusto entra ANTES del gasto (DR-039, rediseño 2026-07-01).
      </Lead>
      <Panel>
        <KvRow label="Fase 1" isFirst>
          <B weight={500}>Barrido teaser</B> (barato y ancho): lentes de caza — app-enhancement
          (quejas de apps conocidas → extensiones), tus otras identidades, own-itch/QoL, challenger
          de incumbentes (rebuild AI-first / unbundling 80-20) — y 8-12 teasers presentados como un{" "}
          <B weight={500}>widget de decisión inline</B>, cada uno con el problema, la solución
          propuesta y una primera lectura de viabilidad técnica, sobre evidencia de fuentes
          verificadas (playbook sources.md).
        </KvRow>
        <KvRow label="Fase 2" isFirst={false}>
          <B weight={500}>Deep-dive</B> (caro y estrecho): tú eliges los 2-3 que te chispean y solo
          esos pasan por los gates duros —incluido un <B weight={500}>spike de viabilidad técnica</B>{" "}
          que confirma que el dato/capacidad crítica se puede conseguir antes de construir— y el
          memo-pitch. Tus reacciones al resto se destilan como patrones de atracción/rechazo en tu
          perfil (DR-053).
        </KvRow>
      </Panel>
      <NotePanel icon="ti-scale">
        Un lente cuyo dolor tu propio tablero ya saturó (hoy: el coleccionista) queda en descanso.
        El criterio dual se honra: no descarta una idea alineada por monetizar poco, ni una idea
        general brillante por no ser «tu tema».
      </NotePanel>

      <DocH title="recommend usa la misma lógica dual" />
      <Body>
        <Code>/pandacorp:recommend</Code> arma el ranking ponderando, además del score: alineación
        con el perfil, <B weight={500}>tipo de retorno</B> (monetario, de oportunidad o personal;
        pesado por tu apetito), balance de portfolio y quick wins. Lo presenta en{" "}
        <B weight={500}>dos bloques</B>: «Mejores apuestas» y «Alineadas contigo».
      </Body>

      <DocH title="El perfil se mantiene vivo solo (DR-053)" />
      <NotePanel icon="ti-refresh" iconColor="var(--color-accent)">
        El perfil <B weight={600}>no es un formulario de una sola vez</B>: es un documento vivo.
        Cuando revelas un hecho personal y durable sobre ti en cualquier conversación, el agente lo
        escribe/actualiza en el perfil (lee primero, deduplica, nunca duplica). El destino es
        siempre <Code>factory/profile.md</Code>. No te pide permiso para anotar un hecho personal.
      </NotePanel>
      <NotePanel icon="ti-stack-2">
        El perfil del dueño es un plano distinto de la <B weight={500}>memoria de ingeniería</B> (
        <Code>factory/memory/</Code>, lecciones reutilizables) y del{" "}
        <B weight={500}>decision-log</B> (historia). No se mezclan.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT: Operar desde cualquier agente (multi-runtime)
// ---------------------------------------------------------------------------

function ConceptMultiRuntime(): React.JSX.Element {
  return (
    <>
      <DocH title="Operar desde cualquier agente" level={1} />
      <Lead>
        Desde 2026-07-04 (DR-113) la fábrica no vive casada con Claude Code: puedes abrir panda-corp
        —o cualquier proyecto— en la app de <B weight={600}>Codex</B> (o su CLI, Cursor, OpenCode) y
        operar con las mismas reglas, los mismos skills y el mismo estado. Nadie elige runtime con
        un switch:{" "}
        <B weight={600}>cada herramienta se auto-selecciona por lo que es capaz de leer</B>.
      </Lead>

      <DocH title="Dos puertas, un núcleo" />
      <Lead>
        Piensa en un edificio con dos puertas que llevan al mismo taller. Cada puerta tiene su capa
        propia; ambas abren al mismo conjunto de ficheros.
      </Lead>
      <Panel>
        <MultiRuntimeDiagram />
      </Panel>
      <NotePanel icon="ti-lock" iconColor="var(--color-warn)">
        <B weight={600}>Cambio de runtime: en frío y desde un safe point.</B> Los ficheros conservan
        el estado durable, pero no reconstruyen todavía todo el scheduler que mantiene un ejecutor
        vivo. El lease atómico, fencing, presupuesto y salud durables ya están probados; Codex sigue
        solo lectura/review hasta el canario live R10 y R11. Un runtime posterior puede continuar
        únicamente cuando el anterior cerró su gate y commit, llegó a un safe point, se detuvo por
        completo y liberó ownership. R10 ya prueba este relevo en un proyecto desechable con los
        CLIs reales; todavía falta el canario entre las aplicaciones instaladas y R11 desatendido.
        Nunca hay takeover vivo ni dos builds simultáneos.
      </NotePanel>

      <DocH title="Qué funciona igual y qué degrada" />
      <Lead>
        La regla es honesta: donde un mecanismo no porta, la gobernanza sigue vinculando como
        instrucción. Un runtime más débil es más lento y más manual,{" "}
        <B weight={600}>nunca menos correcto</B>. El detalle completo vive en el estándar{" "}
        <Code>factory/standards/agent-portability.md</Code> (reglas PORT-1…6).
      </Lead>
      <Panel>
        <div style={{ overflowX: "auto" }}>
          <RuntimeComparison />
        </div>
      </Panel>

      <DocH title="Single source of truth · qué es enlace, qué es generado" />
      <Lead>
        Una sola fuente por cosa; lo demás es symlink, import o artefacto generado. Las copias
        derivadas están automatizadas y el gate las compara con su fuente.
      </Lead>
      <Panel>
        <div style={{ overflowX: "auto" }}>
          <SourceOfTruthMap />
        </div>
      </Panel>
      <NotePanel icon="ti-git-compare" iconColor="var(--color-accent)">
        <B weight={600}>La capa derivada ya no depende del ritual.</B> Desde 2026-07-04 el gate{" "}
        <Code>check-derived-drift.sh</Code> (hook de Stop en el repo de la fábrica) verifica en cada
        sesión que los TOML generados coinciden con sus fuentes, que ambos manifests del plugin
        llevan la misma versión y que el symlink <Code>.agents/skills</Code> resuelve. Deriva
        detectada = la sesión no puede declararse terminada hasta regenerar.
      </NotePanel>

      <DocH title="Telemetría: dos transportes, un idioma" />
      <Lead>
        Claude conserva <Code>~/.claude/dashboard-events.ndjson</Code>; Codex escribe su propio{" "}
        <Code>~/.codex/dashboard-events.ndjson</Code>. Mission Control lee ambos y los normaliza con
        el vocabulario único de <Code>plugin/runtime/event-vocabulary.json</Code>, conservando los
        nombres visuales de La Fragua. El feed deduplica replays exactos por <Code>event_id</Code>.
        Para XP/logros, la identidad
        semántica es solo higiene: un hecho durable entra al ledger v2 únicamente cuando un oráculo
        canónico de archivos, Git o artefactos lo confirma. Los eventos nunca deciden fase, work
        order ni build: esos hechos siguen viniendo de archivos canónicos.
      </Lead>
      <NotePanel icon="ti-plug-connected" iconColor="var(--color-accent)">
        El estado del plugin también separa puertas: Claude y Codex tienen veredictos de cache
        instalado independientes. Que una esté al día no demuestra nada sobre la otra.
      </NotePanel>

      <DocH title="Si modificas algo, ¿qué debes tocar?" />
      <Lead>
        Para que un cambio funcione en ambas puertas, esto es lo mínimo que hay que hacer en cada
        caso.
      </Lead>
      <Panel>
        <ModificationGuide />
      </Panel>
      <NotePanel icon="ti-shield-x" iconColor="var(--color-warn)">
        <B weight={600}>Enforcement en Codex tiene dos estados.</B> La política, los adaptadores y
        las proyecciones de hooks/config ya están certificados en fuente. Hasta instalar el plugin,
        revisar sus definiciones y darles trust en una sesión real, AGENTS.md sigue siendo el piso
        vinculante y no se reclama enforcement activo. BL-0030 permanece abierto hasta cerrar ese
        canario de instalación; nunca se salta el trust.
      </NotePanel>

      <DocH title="Cómo probar que funciona" />
      <NumberedTrail
        steps={[
          {
            title: <>Codex, en frío</>,
            body: (
              <>
                Abre panda-corp en la app de Codex → debe hablarte en <B weight={500}>español</B> y
                listar los 25 skills (<Code>/skills</Code>).
              </>
            ),
          },
          {
            title: <>Codex, revisión segura</>,
            body: (
              <>
                Abre un proyecto detenido en un safe point y pídele a Codex revisar sus work orders,
                commits y evidencia del gate,{" "}
                <B weight={500}>sin mutar el estado de construcción</B>. El build atendido se
                habilita sólo cuando PORT-5 registre en verde el canario instalado
                Claude→Codex→Claude de R10 y el <Code>LIVE_OVERNIGHT</Code> de R11; R2, R3, R6 y los
                fixtures offline ya están verdes, pero no conceden permiso por sí solos.
                Cuando se habilite, Codex Desktop debe lanzar en modo <Code>foreground</Code>: la
                tarea permanece abierta como dueña del supervisor y propaga la cancelación. El modo
                background queda reservado para shells persistentes.
              </>
            ),
          },
          {
            title: <>Claude, intacto</>,
            body: (
              <>
                La misma prueba vía <Code>/pandacorp:implement</Code> — motor background, supervisor
                y Fragua completa, como siempre.
              </>
            ),
          },
        ]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// GUIDE: Adoptar un proyecto que ya tienes
// ---------------------------------------------------------------------------

function GuideAdoptar(): React.JSX.Element {
  return (
    <>
      <DocH title="Adoptar un proyecto que ya tienes" level={1} />
      <Lead>
        ¿Tienes un proyecto que NO nació del handoff de Pandacorp —externo, brownfield— y quieres
        meterlo bajo la fábrica? Para eso está <Code>/pandacorp:adopt</Code>: el espejo brownfield
        de <Code>scaffold</Code>. En vez de crear un proyecto vacío,{" "}
        <B weight={600}>envuelve lo que ya existe</B>. Se corre <B weight={600}>DENTRO</B> de la
        carpeta del proyecto.
      </Lead>
      <NumberedTrail
        steps={[
          {
            title: <>Tocar un proyecto existente = gate humano</>,
            body: (
              <>
                adopt presenta el <B weight={500}>plan de adopción</B> y espera tu OK antes de
                escribir nada (DR-045, DR-038).
              </>
            ),
          },
          {
            title: <>El código da solo un techo, no la fase</>,
            body: (
              <>
                Inspecciona stack, estructura, <Code>git log</Code> y <Code>git remote</Code> para
                un <B weight={500}>techo candidato</B> (una cota superior): deploy vivo →{" "}
                <Code>release</Code>
                {"; sin deploy → "}
                <Code>architecture</Code> (adopt no emite work orders, nunca{" "}
                <Code>implementation</Code>). Declara el techo y su evidencia.
              </>
            ),
          },
          {
            title: <>La fase se DERIVA de gates de calidad documental (DR-119)</>,
            body: (
              <>
                Adopt ya no <B weight={500}>estampa</B> la fase del código: corre —una vez, de abajo
                arriba hasta el techo— las <B weight={500}>mismas baterías</B> que los skills de
                cada fase (producto: contradicciones DR-116 + sin <Code>[NEEDS CLARIFICATION]</Code>{" "}
                + campos agent-critical; diseño: axe-core + Playwright + entregables + lectura
                anti-omisión §1c). La <B weight={500}>primera batería que falla topa la fase</B>. La
                readiness de arquitectura se difiere a <Code>/pandacorp:architecture</Code>. Los
                huecos se reportan <B weight={500}>por fase</B>.
              </>
            ),
          },
          {
            title: <>Cierre según la fase derivada</>,
            body: (
              <>
                Fase <B weight={500}>manual</B> (product/design/architecture) → escribe{" "}
                <Code>phase</Code> + <Code>advance_pending: true</Code> y para (DR-032). App{" "}
                <B weight={500}>viva</B> (<Code>release</Code>) → mantiene{" "}
                <Code>phase: release</Code> (no se degrada el tablero) y cada batería fallida se
                archiva como tarjeta de <Code>/change</Code>, enrutando a{" "}
                <Code>/pandacorp:design</Code> + <Code>/pandacorp:review-launch</Code>. Tras tu
                confirmación, adopt puede{" "}
                <B weight={500}>ofrecerte lanzar ese siguiente skill en la misma conversación</B>{" "}
                (un solo salto, nunca directo a <Code>/pandacorp:implement</Code>) — solo lo lanza
                si respondes que sí.
              </>
            ),
          },
          {
            title: <>Inyecta el overlay SIN pisar</>,
            body: (
              <>
                Copia las plantillas (<Code>CLAUDE.md</Code>, <Code>AGENTS.md</Code>,{" "}
                <Code>.pandacorp/</Code>) pero nunca sobrescribe: si ya tienes{" "}
                <Code>CLAUDE.md</Code>, <B weight={500}>añade</B> las líneas de import sin tocar tu
                contenido.
              </>
            ),
          },
          {
            title: <>Reconstruye docs as-built mínimas</>,
            body: (
              <>para que el proyecto tenga la documentación base que el resto de skills esperan.</>
            ),
          },
          {
            title: <>Registra en la fábrica: ficha (Tablero) y Portfolio, ambas siempre</>,
            body: (
              <>
                Crea <B weight={500}>siempre</B> una <B weight={500}>ficha de idea retroactiva</B> (
                <Code>factory/ideas/&lt;slug&gt;.md</Code>, <Code>status: in-pipeline</Code>) y la
                copia a <Code>.pandacorp/idea-origin.md</Code> — esa ficha es lo que hace que el
                proyecto salga en el <B weight={500}>Tablero</B>. Añade también la fila a{" "}
                <Code>factory/portfolio.md</Code> <B weight={500}>en el momento de adoptar</B>, sea
                cual sea la fase inferida — igual que <Code>scaffold</Code>/<Code>spec</Code> la
                registran al nacer.
              </>
            ),
          },
          {
            title: <>Handoff a los skills normales</>,
            body: (
              <>
                Desde ahí operas el proyecto como cualquier otro: <Code>/pandacorp:iterate</Code>,{" "}
                <Code>/pandacorp:implement</Code>, <Code>/pandacorp:release</Code>…
              </>
            ),
          },
        ]}
      />
      <NotePanel icon="ti-plug-connected" iconColor="var(--color-accent)">
        Tras adoptar, el proyecto aparece de inmediato en el <B weight={600}>Tablero</B> de Mission
        Control (por su ficha) y también en el <B weight={600}>Portfolio</B> (por su fila), con su
        fase inferida, igual que un proyecto nacido del handoff.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// GUIDE: Documentar cambios hechos a mano (el flujo inverso)
// ---------------------------------------------------------------------------

function GuideSync(): React.JSX.Element {
  return (
    <>
      <DocH title="Documentar cambios hechos a mano" level={1} />
      <Lead>
        ¿Editaste el código directamente —para ir rápido, para verlo cambiar en vivo— sin pasar por{" "}
        <Code>/spec</Code>, <Code>/design</Code>, <Code>/implement</Code> o <Code>/change</Code>? El
        código se adelantó a los documentos. <Code>/pandacorp:sync</Code> es el{" "}
        <B weight={600}>flujo inverso</B>: del <B weight={600}>código a los documentos</B>, no al
        revés. Es <Code>/pandacorp:iterate</Code> al revés, y se corre <B weight={600}>DENTRO</B>{" "}
        del proyecto.
      </Lead>
      <NumberedTrail
        steps={[
          {
            title: <>El código es el oráculo: documenta, no verifica</>,
            body: (
              <>
                No puede saber si un cambio es <B weight={500}>correcto</B>, solo describir lo que
                el código hace. Por eso lo que escribe se marca{" "}
                <B weight={500}>reconciled-from-code</B> (como las docs as-built de{" "}
                <Code>/adopt</Code>), nunca como diseño autorizado.
              </>
            ),
          },
          {
            title: <>Con contexto, o en frío (auditoría completa)</>,
            body: (
              <>
                Si la conversación ya tiene los cambios, parte de ahí (pero verifica el diff real).
                Sin contexto hace una <B weight={500}>auditoría completa</B>: recorre toda la app
                contra los docs y encuentra todos los gaps.
              </>
            ),
          },
          {
            title: <>La dirección decide la acción</>,
            body: (
              <>
                Solo documenta lo que el código hace de <B weight={500}>más</B>. Si el doc tiene
                razón, no lo degrada: un <B weight={500}>bug</B> (el código contradice un doc
                correcto) se deriva a <Code>/pandacorp:change</Code>; una feature{" "}
                <B weight={500}>documentada pero no construida</B>, se marca pendiente. La
                especificación nunca se rebaja para describir un código roto.
              </>
            ),
          },
          {
            title: <>Exhaustivo: toda la cascada, en ambos árboles</>,
            body: (
              <>
                Un cambio de comportamiento toca el <Code>FRD</Code> <B weight={500}>y</B> su work
                order <B weight={500}>y</B> el <Code>fdd</Code>; arquitectura → blueprint + ADR; UI
                → fdd + tokens. Barre <Code>docs/</Code> y <Code>.pandacorp/</Code>. Nada se queda
                sin documentar.
              </>
            ),
          },
          {
            title: <>Gate de intención (lo decides tú)</>,
            body: (
              <>
                Te muestra el plan y clasificas cada divergencia: <B weight={500}>documentar</B> ·
                actualizar-doc · es-bug · pendiente · experimento. Es el único sitio donde se
                distingue un bug de un cambio deliberado.
              </>
            ),
          },
          {
            title: <>Dos capas + el espejo de Claude Design</>,
            body: (
              <>
                Cada cambio actualiza el doc dueño <B weight={500}>y</B> registra la entrada en{" "}
                <Code>docs/decision-log.md</Code> (el «porqué» se te pregunta). Si el diseño vive
                también en Claude Design, sync <B weight={500}>avisa y ofrece</B> re-sincronizar vía{" "}
                <Code>/design-sync</Code> — nunca empuja solo.
              </>
            ),
          },
        ]}
      />
      <NotePanel icon="ti-arrow-back-up" iconColor="var(--color-accent)">
        Complementa a <Code>/pandacorp:change</Code>: <B weight={600}>sync</B> documenta lo que el
        código hizo de <B weight={600}>más</B>; <Code>change</Code>/<Code>bug</Code> arregla lo que
        el código hace de <B weight={600}>menos</B>.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// GUIDE: Cómo pedir un cambio
// ---------------------------------------------------------------------------

function GuideCambio(): React.JSX.Element {
  return (
    <>
      <DocH title="Cómo pedir un cambio" level={1} />
      <Lead>
        <Code>/pandacorp:change</Code> es <B weight={600}>la puerta única</B> para pedirle a un
        proyecto CUALQUIER cambio —una feature nueva, un ajuste o un bug—. No tienes que recordar
        qué es: lo describes en lenguaje normal y el skill lo clasifica, le da una clase de urgencia
        y lo deja en la cola de cambios <Code>.pandacorp/inbox/changes/</Code>.
      </Lead>
      <NotePanel icon="ti-shield-check" iconColor="var(--color-ok)">
        <B weight={600}>Es seguro por diseño (DR-069).</B> <Code>change</Code> solo captura +
        clasifica + escribe un fichero a la cola. No edita docs/work-orders/código y no tiene lógica
        de detección de build, así que no puede confundirse sobre si hay un build corriendo y
        corromperlo.
      </NotePanel>
      <Panel>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text2)",
            marginBottom: "6px",
          }}
        >
          Cómo viaja un cambio
        </div>
        <ChipFlow>
          <Chip tone="accent">/change</Chip>
          {RIGHT_ARROW}
          <Chip tone="info">cola de cambios</Chip>
          {RIGHT_ARROW}
          <Chip tone="warn">punto seguro del build</Chip>
          {RIGHT_ARROW}
          <Chip tone="ok">mismo gate de revisión/test</Chip>
        </ChipFlow>
      </Panel>
      <Panel>
        <Ul>
          <li>
            <B weight={500}>El build drena la cola en su punto seguro</B> (entre features, nunca a
            mitad de una). Si no hay build, <Code>/pandacorp:implement</Code> la vacía cuando lo
            corres.
          </li>
          <li>
            <B weight={500}>Clase de servicio:</B> <Chip tone="danger">expedite</Chip> (urgente /
            rompe algo / bloquea pruebas → salta al frente) o <Chip tone="secondary">standard</Chip>{" "}
            (default, FIFO).
          </li>
          <li>
            <B weight={500}>draft vs ready:</B> <Chip tone="ok">ready</Chip> = completo, el build lo
            construye; <Chip tone="secondary">draft</Chip> = lo aparcas para visibilidad, el build
            lo SALTA hasta que lo pases a ready. Mission Control muestra ambos.
          </li>
          <li>
            <B weight={500}>
              <Code>bug</Code> e <Code>iterate</Code> son los motores internos.
            </B>{" "}
            Tú solo recuerdas <Code>/change</Code>; siguen existiendo como alias directos.
          </li>
          <li>
            <B weight={500}>¿Es un hito, no un cambio suelto?</B> Un rediseño grande o un paquete de
            cambios con su propio mini-PRD NO va a la cola: <Code>change</Code> lo clasifica como
            hito, te lo explica y —solo con tu OK explícito en esa misma conversación— lo pasa al
            motor <Code>new-version</Code> (DR-069 §5). Si lo prefieres más chico, vuelve a la
            clasificación normal feature/cambio.
          </li>
        </Ul>
      </Panel>
      <NotePanel icon="ti-help-circle" iconColor="var(--color-warn)">
        ¿Te preguntó algo el build? Eso NO es un cambio (va en sentido contrario) → usa{" "}
        <Code>/pandacorp:decide</Code>.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// WORKFLOWS: Qué es un Dynamic Workflow (overview)
// ---------------------------------------------------------------------------

const SKILL_TABLE_TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid var(--color-border)",
  color: "var(--color-text2)",
  fontWeight: 500,
};

const SKILL_TABLE_TD_STYLE: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "top",
};

const SKILL_VS_WORKFLOW_ROWS: ReadonlyArray<{
  label: string;
  skill: string;
  workflow: string;
}> = [
  {
    label: "Qué es",
    skill: "Instrucciones que el modelo lee e interpreta",
    workflow: "Un guion JS que ejecuta pasos fijos",
  },
  {
    label: "Orquestación",
    skill: "La improvisa el modelo cada vez",
    workflow: "Determinista: paralelo/gates/topes en código",
  },
  {
    label: "Cuándo brilla",
    skill: "Trabajo conversacional, con matices, único",
    workflow: "Fan-out repetitivo + checkpoints + reanudable",
  },
  {
    label: 'En el menú "/"',
    skill: "Sí (aparece como comando)",
    workflow: "No — vive en .claude/engines/, lo lanza un skill",
  },
] as const;

/** One engine card in the overview's "Los motores que existen hoy" section — links to its sub-page. */
function EngineCard({
  icon,
  title,
  body,
  group,
  slug,
}: {
  icon: string;
  title: React.ReactNode;
  body: React.ReactNode;
  group: string;
  slug: string;
}): React.JSX.Element {
  const nav = useManualNav();
  return (
    <button
      type="button"
      onClick={() => nav.goToManual(group, slug)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "inherit",
        marginBottom: "8px",
      }}
    >
      <Panel variant="rpgpanel">
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <i
            className={`ti ${icon}`}
            aria-hidden="true"
            style={{ fontSize: "18px", color: "var(--color-accent)", marginTop: "1px" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
              {title}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text2)",
                marginTop: "3px",
                lineHeight: 1.5,
              }}
            >
              {body}
            </div>
          </div>
          <i
            className="ti ti-chevron-right"
            aria-hidden="true"
            style={{ fontSize: "16px", color: "var(--color-text3)", flex: "0 0 auto" }}
          />
        </div>
      </Panel>
    </button>
  );
}

function WorkflowsOverview(): React.JSX.Element {
  return (
    <>
      <DocH title="Dynamic Workflows" level={1} />
      <Lead>
        Un <B weight={600}>Dynamic Workflow</B> es un guion de JavaScript que orquesta subagentes de
        forma <B weight={600}>determinista</B>: decide en código qué corre en paralelo, qué espera a
        qué, dónde hay un control de calidad, cuántos agentes como mucho y cómo retomar si algo se
        corta. No es un agente que improvisa — es una cinta de montaje con estaciones fijas.
      </Lead>

      <NotePanel icon="ti-tools" iconColor="var(--color-accent)">
        Piensa en la diferencia entre un <B weight={600}>cocinero</B> y una{" "}
        <B weight={600}>cadena de montaje</B>.
        <Ul>
          <li>
            Un <B weight={500}>skill</B> es el cocinero: lee la receta y se organiza de cabeza. Es
            flexible y conversa contigo, pero cada vez lo hace un poco distinto.
          </li>
          <li>
            Un <B weight={500}>dynamic workflow</B> es la cadena de montaje: la cinta y las
            estaciones están soldadas en su sitio. Procesa cien piezas iguales sin cansarse, cada
            una pasa por los mismos controles, y si se va la luz, al volver sigue por donde iba — no
            reempieza.
          </li>
        </Ul>
        Cuando hay MUCHAS piezas iguales y controles estrictos, quieres la cadena, no al cocinero
        improvisando.
      </NotePanel>

      <DocH title="Skill vs Workflow" />
      <Panel>
        <div style={{ overflowX: "auto" }}>
          <table
            data-testid="workflows-skill-vs-workflow-table"
            style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}
          >
            <thead>
              <tr>
                <th style={SKILL_TABLE_TH_STYLE} />
                <th style={SKILL_TABLE_TH_STYLE}>Skill</th>
                <th style={SKILL_TABLE_TH_STYLE}>Dynamic Workflow</th>
              </tr>
            </thead>
            <tbody>
              {SKILL_VS_WORKFLOW_ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...SKILL_TABLE_TD_STYLE, color: "var(--color-text2)" }}>
                    {row.label}
                  </td>
                  <td style={{ ...SKILL_TABLE_TD_STYLE, color: "var(--color-text3)" }}>
                    {row.skill}
                  </td>
                  <td style={{ ...SKILL_TABLE_TD_STYLE, color: "var(--color-text)" }}>
                    {row.workflow}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <DocH title="La forma que se repite: fan-out → compuerta" />
      <Body>
        Casi todos los workflows tienen la misma silueta: <B weight={500}>se abren en abanico</B>{" "}
        (muchos subagentes trabajando a la vez) y luego <B weight={500}>embudo</B> por una compuerta
        que verifica antes de dejar pasar. Es como un periódico: muchos reporteros escriben
        secciones en paralelo, pero todo pasa por la mesa del editor antes de imprimir. Si la
        compuerta es "split", en vez de un editor hay cuatro especialistas (hechos, legal, estilo,
        maqueta) leyendo a la vez, y un jefe de redacción firma solo lo que sobrevive.
      </Body>
      <Panel>
        <WorkflowShapeDiagram />
      </Panel>

      <DocH title="Por qué determinista (y no dejar que el modelo improvise)" />
      <Panel>
        <Ul>
          <li>
            <B weight={500}>Fiabilidad</B>: el merge se hace de uno en uno, siempre; nunca dos a la
            vez pisándose.
          </li>
          <li>
            <B weight={500}>Velocidad</B>: lo independiente corre de verdad en paralelo, no en fila.
          </li>
          <li>
            <B weight={500}>Reanudable</B>: el estado vive en disco (el frontmatter de cada work
            order), así que relanzar = leer dónde te quedaste. Nunca se rehace algo ya verificado.
          </li>
        </Ul>
      </Panel>

      <DocH title="Los motores que existen hoy" />
      <EngineCard
        icon="ti-building-factory-2"
        title="pandacorp-build — el motor de construcción"
        body={
          <>
            Levanta un proyecto entero, feature por feature, en oleadas. Lo lanza{" "}
            <Code>/pandacorp:implement</Code>.
          </>
        }
        group="workflows"
        slug="wf-pandacorp-build"
      />
      <EngineCard
        icon="ti-git-merge"
        title="pandacorp-backlog — el motor de drenado del backlog"
        body={
          <>
            Resuelve los BL-* en paralelo y los mergea de uno en uno. Lo lanza{" "}
            <Code>/pandacorp:implement-backlog</Code> (sin argumentos).
          </>
        }
        group="workflows"
        slug="wf-pandacorp-backlog"
      />

      <NotePanel icon="ti-eye-off" iconColor="var(--color-text2)">
        Los dos viven en <Code>.claude/engines/</Code> — una carpeta que el menú "/" NO escanea,
        para que estos motores internos no aparezcan como comandos sueltos. Los invoca siempre un
        skill, nunca tú a mano.
      </NotePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// WORKFLOWS: pandacorp-build — el motor de construcción
// ---------------------------------------------------------------------------

function WorkflowBuild(): React.JSX.Element {
  return (
    <>
      <DocH title="pandacorp-build — el motor de construcción" level={1} />
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <Chip tone="accent">
          <Code>/pandacorp:implement</Code>
        </Chip>
        <Chip tone="secondary">corre en el proyecto</Chip>
        <Chip tone="ok">segundo plano · reanudable</Chip>
      </div>
      <Lead>
        Es la joya de la corona: construye un proyecto entero leyendo las FRDs y sus work orders, y
        no para hasta terminar (o hasta que topa con presupuesto, salud, o algo que solo tú puedes
        decidir). Construye en <B weight={600}>oleadas globales</B>: cada oleada agarra los work
        orders LISTOS de TODAS las features a la vez (los que tienen sus dependencias hechas y no
        chocan de archivos), así las features independientes avanzan en paralelo.
      </Lead>

      <NotePanel icon="ti-building-skyscraper" iconColor="var(--color-accent)">
        Como levantar un edificio: no puedes construir el piso 3 antes del 2, pero dentro de un piso
        hay muchos obreros a la vez, y cada piso se inspecciona antes de subir al siguiente. La
        inspección es la compuerta de revisión — y esa inspección ahora la hacen varios
        especialistas en paralelo.
      </NotePanel>

      <Panel>
        <FlowGraph flow={buildFlow} />
      </Panel>

      <DocH title="El gate de revisión, ahora en abanico (reviewSplit)" />
      <Body>
        Al cerrar cada feature, antes se pasaba por UN revisor en serie. Ahora, en los modos
        potentes (powerful/deep), la revisión se{" "}
        <B weight={500}>abre en cuatro lentes en paralelo</B> — corrección, seguridad, calidad y
        runtime/visual — se deduplican los hallazgos, cada hallazgo se{" "}
        <B weight={500}>verifica de forma adversarial</B> (un escéptico intenta refutarlo; si no
        puede anclarlo, muere), y un revisor de cierre (Opus) firma solo lo confirmado. Si no cabe
        en el tope de agentes, cae con elegancia al revisor en serie de siempre. En los modos
        ligeros (pro/balanced) sigue siendo el revisor en serie, idéntico a antes.
      </Body>

      <DocH title="La revisión y la construcción ahora se solapan" />
      <Body>
        Antes, el motor se PARABA a revisar cada feature: mientras el juez deliberaba, nadie
        construía. Ahora una feature lista para revisión se juzga en un{" "}
        <B weight={500}>worktree congelado</B> (una copia del proyecto anclada al commit exacto en
        que quedó verde) MIENTRAS el build sigue forjando otras features. Cuando el gate aprueba, el
        motor sella ese work order como VERIFIED en la rama principal de forma serializada (un
        cambio a la vez, sin pisarse); si rechaza, esa feature vuelve a la escalera de recuperación.
        En el Party lo ves como lo que es: el tribunal <B weight={500}>abre</B> (evento{" "}
        <Code>gate</Code>) y <B weight={500}>cierra</B> (evento <Code>GateVerdict</Code>) sin
        congelar la forja, y una orden rechazada camina de vuelta a la forja (↩️{" "}
        <Code>wo_reopen</Code>).
      </Body>

      <DocH title="Si algo falla: repara antes de bloquear (la escalera)" />
      <Body>
        Un fallo ya no para el build ni lo marca BLOCKED a la primera. El motor sube una{" "}
        <B weight={500}>escalera de recuperación</B>, y cada peldaño queda anotado en un diario
        durable (<Code>.pandacorp/build-journal.jsonl</Code>, committeado — sobrevive a un corte):
      </Body>
      <div style={{ marginBottom: "10px" }}>
        <Panel>
          <Ul>
            <li>
              <B weight={500}>Diagnostica primero.</B> Antes de tocar nada, clasifica el fallo:
              puntual (un test, un borde), arquitectónico (el diseño no da), gate-test-defective (el
              test del gate es el que está mal, no el código) o contrato en punto muerto.
            </li>
            <li>
              <B weight={500}>Parchea informado.</B> Aplica un arreglo guiado por el diagnóstico
              (hasta 2 intentos), no un palo de ciego.
            </li>
            <li>
              <B weight={500}>Revierte solo la costura.</B> Si no converge, deshace SOLO la parte
              tocada (revert parcial de la costura), no toda la feature.
            </li>
            <li>
              <B weight={500}>Bloquea temprano y con motivo.</B> Si de verdad necesita al owner,
              marca BLOCKED con la razón (needs-owner | external | error) y sigue con las features
              independientes — nunca se queda dando vueltas.
            </li>
          </Ul>
        </Panel>
      </div>
      <Body>
        En el feed del Party estos momentos tienen icono propio: <B weight={500}>↩️ WO reabierto</B>,{" "}
        <B weight={500}>🩹 Parche</B>, la <B weight={500}>✅/❌ prueba de humo</B> (el revisor
        renderiza las rutas de verdad) y el <B weight={500}>🛡️ Endurecimiento</B> del cierre.
      </Body>

      <DocH title="Cómo lo lanzas · el checklist" />
      <Body>
        <Code>/pandacorp:implement</Code> corre dos guiones antes de soltar el motor de noche:{" "}
        <Code>preflight-implement.sh</Code> comprueba que todo esté listo (el último verde, que no
        haya otro build corriendo — el candado de un-build-a-la-vez —, presupuesto y salud) y{" "}
        <Code>launch-implement.sh</Code> arranca el motor junto a su supervisor. Tú no corres nada a
        mano: el skill le pasa también el alcance dirigido (<Code>--frds</Code> o <Code>--change</Code>)
        y los topes de prueba al launcher, que valida todo antes de tomar el candado e imprime una sola
        llamada JSON segura. Nunca se completa esa llamada a mano. A partir de ahí, mira el Party.
      </Body>

      <DocH title="Cómo retoma si se corta" />
      <Body>
        El estado vive en el frontmatter de cada work order (<Code>implementation_status</Code>).
        Relanzar el motor = volver a leer el disco: nunca reconstruye un work order VERIFIED, y uno
        que quedó IN_REVIEW pasa directo a su gate. No hay "run id" mágico — la memoria es el árbol
        de archivos.
      </Body>

      <DocH title="El supervisor" />
      <Body margin="0">
        Nunca se lanza solo: junto al motor va un supervisor (Monitor + ScheduleWakeup +
        PushNotification) que vigila el latido, te avisa al móvil si se atasca o termina, y relanza
        el motor pasada tras pasada hasta que no queda nada. Por eso puedes lanzarlo de noche y
        desentenderte.
      </Body>
    </>
  );
}

// ---------------------------------------------------------------------------
// WORKFLOWS: pandacorp-backlog — el motor de drenado del backlog
// ---------------------------------------------------------------------------

function WorkflowBacklog(): React.JSX.Element {
  return (
    <>
      <DocH title="pandacorp-backlog — el motor de drenado del backlog" level={1} />
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <Chip tone="accent">
          <Code>/pandacorp:implement-backlog</Code> (sin argumentos)
        </Chip>
        <Chip tone="secondary">corre en la fábrica</Chip>
        <Chip tone="ok">reanudable</Chip>
      </div>
      <Lead>
        Drena el backlog de la fábrica (<Code>factory/backlog/BL-*.md</Code>) de forma determinista:
        mide cada ítem, lanza un subagente por ítem EN PARALELO (cada uno aislado en su propio
        worktree), y luego los mergea a main <B weight={600}>de uno en uno</B>, con un validador
        entre cada merge. Antes esto lo improvisaba el skill a mano; ahora es una cinta.
      </Lead>

      <NotePanel icon="ti-car-garage" iconColor="var(--color-accent)">
        Como un taller de reparación: cada coche averiado entra a su propia bahía (worktree) con un
        mecánico del tamaño del trabajo (haiku para lo trivial, sonnet lo normal, opus lo difícil),
        y todos trabajan a la vez. Pero por la única puerta de salida sale UN coche cada vez (merge
        serializado), y se vuelve a inspeccionar antes de dejar salir al siguiente. Si uno no pasa
        la inspección, se devuelve a la bahía y sale el resto.
      </NotePanel>

      <Panel>
        <FlowGraph flow={backlogFlow} />
      </Panel>

      <DocH title="Por qué el merge es de uno en uno" />
      <Body>
        El fan-out del trabajo es paralelo, pero el merge NO: dos merges a la vez se pisarían justo
        en los sitios calientes (la versión del plugin, el decision-log, el contador del README).
        Serializar el merge y correr el validador entre cada uno es exactamente lo que un modelo
        improvisa mal — por eso está soldado en código.
      </Body>

      <DocH title="Modo un-ítem vs drenar-todo" />
      <Body>
        Con un id (<Code>/pandacorp:implement-backlog BL-0007</Code>) el skill arregla ESE ítem
        directo, en la conversación, sin workflow. Sin argumentos, lanza este motor y drena todo el
        backlog abierto.
      </Body>

      <DocH title="Cómo retoma" />
      <Body>
        Natural: el estado es el <Code>status</Code> del frontmatter de cada BL. Relanzar
        re-escanea; los <Code>done</Code> ya no entran. Un ítem que se atasca queda{" "}
        <Code>doing</Code> con su razón, nunca se pierde.
      </Body>

      <NotePanel icon="ti-alert-triangle" iconColor="var(--color-warn)">
        <B weight={600}>Nota de ingeniería.</B> Al validar este motor se aprendió algo: los agentes
        de tier bajo (haiku) tienden a "derivar" al repositorio de su directorio de sesión aunque el
        prompt lleve rutas absolutas. La solución fue un preámbulo ANCHOR en TODOS los prompts
        (mismo patrón que el motor de build) + verificar la propiedad del worktree tras crearlo.
        Determinismo también es blindar al agente contra su propio contexto.
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
  // Guides (prototype's 7 + audit-gap additions)
  "g-cambio": GuideCambio,
  "g-capturar": GuideCapturar,
  "g-handoff": GuideHandoff,
  "g-modo": GuideModo,
  "g-feedback": GuideFeedback,
  "g-probar": GuideProbar,
  "g-traspaso": GuideTraspaso,
  "g-plugin": GuidePlugin,
  "g-adoptar": GuideAdoptar,
  "g-sync": GuideSync,
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
  // Concepts — audit-gap additions
  "el-arco-economico": ConceptArcoEconomico,
  "despues-de-lanzar": ConceptDespuesDeLanzar,
  "servicios-cuentas-secretos": ConceptServiciosSecretos,
  "los-gates-humanos": ConceptGatesHumanos,
  "espinazo-de-documentos": ConceptEspinazoDocs,
  "tu-perfil": ConceptTuPerfil,
  "multi-runtime": ConceptMultiRuntime,
  "vault-y-respaldos": ConceptVault,
  // Workflows
  "que-es-un-workflow": WorkflowsOverview,
  "wf-pandacorp-build": WorkflowBuild,
  "wf-pandacorp-backlog": WorkflowBacklog,
};

/**
 * Resolve a Manual page renderer by slug, or null when none is registered
 * (the caller then falls back to the markdown reader).
 */
export function getManualPageComponent(slug: string): (() => React.JSX.Element) | null {
  return MANUAL_PAGE_COMPONENTS[slug] ?? null;
}

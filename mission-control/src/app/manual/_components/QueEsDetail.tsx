/**
 * manual/_components/QueEsDetail.tsx — FRD-08 "Qué es Pandacorp" detail
 *
 * The mission, what the factory does for the owner, what only the owner does, where
 * the factory lives and why it is called a factory. Composed by `ConceptQueEs` in
 * manualPages.tsx, the only source the reader renders for this slug. The pipeline
 * and the human gates have their own pages; this one links to them.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { B, Body, Code, Ul } from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

/** Sections below the intro card: mission, division of labour, location, the name. */
export function QueEsDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="La misión" />
      <Body>
        Construir un portfolio de soluciones tecnológicas (apps web y móviles, herramientas CLI,
        automatizaciones, sistemas de prompts) que generen retorno económico u oportunidad, con el
        mínimo esfuerzo humano repetitivo. Cada fase produce artefactos versionados en el
        repositorio del proyecto, las decisiones viven en archivos y no en conversaciones, y tú
        apruebas cada fase antes de avanzar (ver{" "}
        <ManualLink group="concepts" slug="el-pipeline">
          El pipeline
        </ManualLink>
        ).
      </Body>

      <DocH title="Qué hace la fábrica por ti" />
      <Ul>
        <li>
          <B weight={500}>Explora</B> ideas contigo en conversación hasta que sean accionables.
        </li>
        <li>
          <B weight={500}>Documenta</B> el PRD, los FRDs y los criterios de aceptación en EARS.
        </li>
        <li>
          <B weight={500}>Diseña</B> la interfaz con un sistema de diseño coherente y tokens
          propios.
        </li>
        <li>
          <B weight={500}>Planifica</B> la arquitectura técnica y la divide en work orders.
        </li>
        <li>
          <B weight={500}>Construye</B> el código con TDD, revisión adversarial y CI verde.
        </li>
        <li>
          <B weight={500}>Publica</B> con un plan de lanzamiento informado por métricas.
        </li>
        <li>
          <B weight={500}>Aprende</B> de cada proyecto: lecciones reutilizables en{" "}
          <Code>factory/memory/</Code>.
        </li>
      </Ul>

      <DocH title="Qué haces tú" />
      <Body>
        Solo intervienes en las <B weight={500}>puertas humanas</B>: elegir qué idea construir,
        aprobar el diseño visual, autorizar el release a producción, gastar dinero o conectar
        servicios externos, eliminar datos y las comunicaciones externas (la lista completa está en{" "}
        <ManualLink group="concepts" slug="los-gates-humanos">
          Los gates humanos
        </ManualLink>
        ). Todo lo demás está automatizado o codificado en el registro de decisiones (
        <Code>factory/decisions/registry.yaml</Code>).
      </Body>

      <DocH title="Dónde vive la fábrica" />
      <Body>
        La fábrica es el repositorio <Code>panda-corp/</Code>. Los proyectos viven en carpetas
        hermanas, cada una con su propio repo. Mission Control (este panel) es la interfaz de
        control de la fábrica y vive dentro de <Code>panda-corp/mission-control/</Code>.
      </Body>

      <DocH title="Por qué «fábrica»" />
      <Body>
        El nombre refleja la intención: un sistema <B weight={500}>repetible</B> que produce
        software de calidad consistente, igual que una fábrica produce bienes físicos con estándares
        de calidad. El know-how está en los procesos (estándares, decisiones, memoria), no en la
        cabeza de una persona.
      </Body>
    </>
  );
}

/**
 * manual/_components/ArquitecturaDetail.tsx — FRD-08 "Arquitectura del sistema" detail
 *
 * The factory's folder layout, the two architecture layers and Mission Control's own
 * principles. The per-project documentation structure (DR-049) lives on the
 * "Espinazo de documentos" page; this one links to it instead of repeating it.
 * Composed by `ConceptArquitectura` in manualPages.tsx, the only source the reader
 * renders for this slug.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.3.
 */

import type React from "react";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import {
  B,
  Body,
  Code,
  MonoBlock,
  NotePanel,
  Ul,
} from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

const FACTORY_TREE = `panda-corp/                        ← repositorio de la fábrica
  factory/                         ← estándares, decisiones, memoria
    constitution.md
    standards/
    decisions/registry.yaml
    memory/
  plugin/                          ← habilidades y agentes del plugin
    skills/<slug>/SKILL.md
    agents/<id>.md
  mission-control/                 ← este panel de control (Next.js)
  <proyecto-A>/                    ← proyecto hermano (repo propio)
  <proyecto-B>/`;

/** Sections below the architecture diagram: layout, two layers, Mission Control. */
export function ArquitecturaDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Estructura de la fábrica" />
      <MonoBlock text={FACTORY_TREE} />

      <DocH title="Cómo se organiza la documentación de un proyecto" />
      <Body>
        Cada proyecto sigue la estructura <B weight={500}>feature-céntrica</B> (DR-049): una capa
        fina de producto en <Code>docs/product/</Code> y un módulo autocontenido por FRD en{" "}
        <Code>docs/frds/frd-NN-&lt;slug&gt;/</Code>, con sus carpetas apareciendo bajo demanda. El
        layout antiguo por tipo (blueprint y work orders sueltos en la raíz de <Code>docs/</Code>)
        no se usa en proyectos nuevos. El detalle, la cadena de trazabilidad de IDs y la jerarquía
        de fuentes de verdad están en{" "}
        <ManualLink group="concepts" slug="espinazo-de-documentos">
          Espinazo de documentos
        </ManualLink>
        .
      </Body>

      <DocH title="Dos capas de arquitectura" />
      <Ul>
        <li>
          <B weight={500}>Plataforma</B> (<Code>docs/product/architecture.md</Code>): stack, modelo
          de datos, deploy y decisiones transversales. Una por proyecto.
        </li>
        <li>
          <B weight={500}>Feature</B> (<Code>docs/frds/frd-NN-&lt;slug&gt;/blueprint.md</Code>): el
          diseño de implementación de esa feature concreta. Una por FRD.
        </li>
      </Ul>
      <NotePanel icon="ti-layers-subtract" iconColor="var(--color-accent)">
        Nunca se fusionan: el blueprint de feature referencia la arquitectura de plataforma, no la
        duplica.
      </NotePanel>

      <DocH title="Arquitectura de Mission Control" />
      <Body margin="0 0 8px">
        Mission Control es una aplicación Next.js con App Router. Sus principios:
      </Body>
      <Ul>
        <li>
          <B weight={500}>Solo lectura</B> sobre la fábrica: lee archivos y no escribe, salvo el{" "}
          <Code>status:</Code> de descarte y el favorito de una tarjeta de idea (FRD-02).
        </li>
        <li>
          <B weight={500}>Server Components</B> por defecto; <Code>&quot;use client&quot;</Code>{" "}
          solo cuando la interactividad lo requiere.
        </li>
        <li>
          <B weight={500}>Derivación en tiempo de render</B>: los catálogos de Referencia se derivan
          de la fuente canónica en cada render, nunca se copian a mano.
        </li>
        <li>
          <B weight={500}>Design tokens únicamente</B>: cero colores ni espaciado escritos a mano.
        </li>
      </Ul>
      <Body margin="10px 0 0">
        Las rutas de cada sección viven en <Code>app/</Code> (proyectos, party, manual,
        configuración), los lectores de datos en <Code>lib/</Code> y las primitivas reutilizables en{" "}
        <Code>components/</Code>.
      </Body>
    </>
  );
}

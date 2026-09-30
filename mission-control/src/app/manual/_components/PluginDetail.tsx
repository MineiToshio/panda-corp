/**
 * manual/_components/PluginDetail.tsx — FRD-08 "El plugin" detail
 *
 * How skills are named and invoked, the semver policy, install/update and the fact
 * that the plugin never travels with a project. The skills list itself is NOT
 * repeated here: Referencia → Comandos derives it from `plugin/skills/` (DR-046).
 * Composed by `ConceptPlugin` in manualPages.tsx, the only source the reader
 * renders for this slug.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.1, AC-08-005.2.
 */

import type React from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { B, Body, Code, NotePanel, Ul } from "@/components/modules/manual-diagrams/prose";

/** Sections below the plugin structure: skills, semver, install, project independence. */
export function PluginDetail(): React.JSX.Element {
  return (
    <>
      <DocH title="Las habilidades (/pandacorp:*)" />
      <Body>
        Cada habilidad vive en <Code>plugin/skills/&lt;slug&gt;/SKILL.md</Code> y se invoca como{" "}
        <Code>/pandacorp:&lt;slug&gt;</Code>. El prefijo <Code>pandacorp:</Code> lo pone el plugin
        solo: nunca se incluye en el nombre de la carpeta. La lista completa, siempre al día, está
        en <B weight={500}>Referencia → Comandos</B>, derivada de esa misma carpeta.
      </Body>

      <DocH title="Versionado semántico" />
      <Body margin="0 0 8px">El plugin sigue semver (x.y.z):</Body>
      <Ul>
        <li>
          <B weight={500}>PATCH:</B> un fix o un ajuste sin cambio de comportamiento.
        </li>
        <li>
          <B weight={500}>MINOR:</B> una habilidad o un agente nuevo y compatible.
        </li>
        <li>
          <B weight={500}>MAJOR:</B> un cambio incompatible (renombrar o eliminar una habilidad,
          cambiar un flujo).
        </li>
      </Ul>
      <NotePanel icon="ti-tag" iconColor="var(--color-accent)">
        La versión se edita en un solo lugar, <Code>plugin/runtime/plugin-metadata.json</Code>, y
        los manifiestos de Claude y de Codex se generan a partir de él. Cada cambio en{" "}
        <Code>plugin/</Code> bumpa esa versión y registra el motivo en{" "}
        <Code>plugin/docs/decision-log.md</Code>.
      </NotePanel>

      <DocH title="Instalar y actualizar" />
      <Body margin="0 0 8px">Desde el repo local de la fábrica:</Body>
      <CmdRow command="claude plugin install pandacorp@panda-corp" />
      <Body margin="10px 0 8px">Y tras cualquier cambio en plugin/:</Body>
      <CmdRow command="claude plugin update pandacorp@panda-corp" />
      <Body margin="10px 0 0">
        Los cambios aplicados tras la instalación se activan en la siguiente sesión de Claude Code.
      </Body>

      <DocH title="El plugin no viaja con el proyecto" />
      <Body>
        El plugin es de la fábrica, no de los proyectos. Un clon solo del proyecto no lo tiene: para
        operarlo con las habilidades <Code>/pandacorp:*</Code> necesitas el repo de la fábrica con
        el plugin instalado. Los proyectos son totalmente funcionales sin él (se desarrollan con{" "}
        <Code>AGENTS.md</Code> como guía), pero esas habilidades no estarán disponibles.
      </Body>
    </>
  );
}

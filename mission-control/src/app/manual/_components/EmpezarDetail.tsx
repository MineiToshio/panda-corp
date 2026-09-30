/**
 * manual/_components/EmpezarDetail.tsx — FRD-08 "Tu primera misión" prerequisites
 *
 * What a person with no context needs installed before the five quickstart steps,
 * and where to read next. Composed by `ManualQuickstart` in manualPages.tsx, the
 * only source the reader renders for this slug.
 *
 * Traceability: CMP-08-concept-pages → AC-08-005.2 (sufficient for someone with no
 * prior context).
 */

import type React from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import { B, Body, Code, Ul } from "@/components/modules/manual-diagrams/prose";
import { ManualLink } from "./ManualLink";

/** The "before you start" block (shown above the steps). */
export function EmpezarPrereqs(): React.JSX.Element {
  return (
    <>
      <DocH title="Qué necesitas antes de empezar" />
      <Ul>
        <li>
          <B weight={500}>Claude Code</B> instalado y con una cuenta activa (comprueba con{" "}
          <Code>claude --version</Code>).
        </li>
        <li>El repositorio de la fábrica clonado en tu máquina.</li>
        <li>
          El plugin Pandacorp instalado en tu sesión de Claude Code: añade todas las habilidades{" "}
          <Code>/pandacorp:*</Code>.
        </li>
      </Ul>
      <Body margin="10px 0 6px">Clonar la fábrica y entrar a su carpeta:</Body>
      <CmdRow command="git clone <repo-url> panda-corp && cd panda-corp" />
      <Body margin="10px 0 6px">Instalar el plugin:</Body>
      <CmdRow command="claude plugin install pandacorp@panda-corp" />
      <Body margin="10px 0 14px">
        Los comandos de los pasos de abajo se ejecutan desde la carpeta raíz de la fábrica (y, desde
        el handoff, dentro de la carpeta del proyecto).
      </Body>
    </>
  );
}

/** The "where to read next" block (shown below the steps). */
export function EmpezarNext(): React.JSX.Element {
  return (
    <>
      <DocH title="A continuación" />
      <Ul>
        <li>
          <B weight={500}>Conceptos:</B> lee{" "}
          <ManualLink group="concepts" slug="que-es-pandacorp">
            Qué es Pandacorp
          </ManualLink>{" "}
          para entender la filosofía de la fábrica.
        </li>
        <li>
          <B weight={500}>El pipeline:</B>{" "}
          <ManualLink group="concepts" slug="el-pipeline">
            El pipeline
          </ManualLink>{" "}
          explica cada fase, de product a release.
        </li>
        <li>
          <B weight={500}>Guías:</B> las guías cubren las tareas puntuales del día a día.
        </li>
      </Ul>
    </>
  );
}

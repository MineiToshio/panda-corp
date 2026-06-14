# Estándares de Pandacorp

Estándares de ingeniería que la fábrica inyecta en cada proyecto (vía el `AGENTS.md`/`CLAUDE.md` del scaffold y los agentes del plugin). Derivados de cómo trabaja Sergio (proyecto de referencia: PandaTrack).

## Dos niveles (importante)

1. **Convenciones duraderas — OBLIGATORIAS e iguales en todos los proyectos**: estructura, naming, calidad, patrones, testing. Viven aquí y no se negocian por proyecto.
2. **Stack tecnológico — SUGERENCIA por defecto**: hay un stack recomendado ([stack.md](stack.md)), siempre en **últimas versiones estables**. NO es obligatorio: el agente `architect` lo **propone en el blueprint**, puede sugerir tecnologías mejores si encajan en el proyecto, y **Sergio lo aprueba** ahí (gate humano ligero, registrado como ADR).

## Categorías (8 dominios) + índice

| Dominio | Estándares |
|---|---|
| **Programación / Convenciones** | [convenciones.md](convenciones.md) · [api-design.md](api-design.md) |
| **Arquitectura / Estructura** | [estructura.md](estructura.md) · [patrones.md](patrones.md) |
| **Diseño / Design system** | [patrones.md](patrones.md) (tokens, tema, a11y); el design system se genera por proyecto en `/pandacorp:design` |
| **Tecnología / Stack** | [stack.md](stack.md) (golden paths A/B/C/D) |
| **Calidad / Testing** | [calidad.md](calidad.md) · [performance.md](performance.md) |
| **Seguridad** | [seguridad-web.md](seguridad-web.md) (+ constitución §12, DR-017, agente `security-auditor`) |
| **Operación / Observabilidad** | [infra.md](infra.md) (dev local) · [observabilidad.md](observabilidad.md) (producción) |
| **Datos / Privacidad** | [privacidad.md](privacidad.md) |
| **Producto / Documentación** | [seo-i18n.md](seo-i18n.md) (+ docs viva: constitución §20, DR-018) |

## Dos ejes transversales (por regla, no por archivo)

- **Severidad (RFC 2119)**: cada regla es `MUST` (obligatoria — violarla es fallo duro), `SHOULD` (recomendada — flexibilizable registrando un ADR) o `MAY` (opcional). El agente **solo escala a Sergio si va a romper un `MUST`**; un `SHOULD` lo decide con un ADR. El stack entero es `SHOULD` (golden path).
- **Enforcement (cómo se verifica)**: `lint` · `CI gate` · `checklist` · `gate humano / deny rule`. Hace visible qué valida un script (verde/rojo automático) vs. qué es decisión de Sergio (regla 4: el modelo nunca marca sus propios checks).

## Forma de un estándar ("estándar ejecutable")

Cada archivo separa, sin mezclar: **Regla** (taxativa, lo que se inyecta al agente) · **Cómo se verifica** (check binario enchufable a `verify.sh`/CI) · **Por qué** (rationale/trade-offs, para humanos y ADRs). El objetivo es que cada regla tenga un verificador, no solo prosa.

## Dos niveles de obligatoriedad

1. **Convenciones duraderas — OBLIGATORIAS** e iguales en todo proyecto (estructura, naming, calidad, patrones, testing, seguridad, privacidad…).
2. **Stack tecnológico — SUGERENCIA** por defecto ([stack.md](stack.md), últimas versiones estables): el `architect` lo propone en el blueprint, puede sugerir mejores, y **Sergio aprueba** (gate ligero, ADR).

Las convenciones de estructura/patrones están escritas para el stack web por defecto (TypeScript/Next.js). Para otros stacks (Python/scraping) se aplica el **espíritu** (capas separadas, data layer aislado, tests colocados, tipado estricto), adaptado al lenguaje. Agregar un estándar o una regla nueva: `/pandacorp:codify`.

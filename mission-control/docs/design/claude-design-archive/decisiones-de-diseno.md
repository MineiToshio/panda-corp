# Decisiones de diseño — Cockpit de Pandacorp

> **Congelado el 2026-06-14.** Dirección elegida: **Atelier**. Tema principal: **Dark**.
> Acento: **azul-acero (hue OKLCH 215)**. Tokens canónicos en
> [`design-tokens.frozen.json`](design-tokens.frozen.json) · paleta visual en
> [`paleta-atelier.html`](paleta-atelier.html) · mockup vivo en
> [`direction-3.html`](direction-3.html) (abre en dark por defecto).

---

## 1. Qué se eligió y por qué

**Atelier** — el cockpit como un **SaaS de ingeniería limpio y aireado**, con la capa RPG
como guarnición (sprites enmarcados, halos, XP) en vez de envolver toda la pantalla. El
**kanban y los datos son protagonistas**; la legibilidad del estado va primero, que es
exactamente el principio del PRD ("la legibilidad de los datos va antes que el show") y el
ajuste correcto para un operador único que mira esto a diario y se describe débil en diseño:
la restricción y los defaults hacen el trabajo, no el "buen ojo".

Frente a las otras dos: **Pergamino** era más cálida-editorial pero menos moderna;
**Cripta** era la más inmersiva (pixel/JRPG) pero más densa y cansada para sesiones largas.
Atelier es la que mejor equilibra deleite RPG + sobriedad de panel.

## 2. El ajuste de color (tu pedido)

- El acento de Atelier era **teal-pino (hue 195)**. Lo desplacé a **azul-acero (hue 215)**,
  subiendo un punto la saturación (chroma 0.10→0.115 en dark) para que lea claramente
  **más azul** sin volverse un azul SaaS genérico que choque con los sprites cálidos.
- Sigue siendo **un único acento racionado** (puntuación, no pintura): solo en tab activa,
  agente trabajando, barra de XP y la acción primaria. Todo lo demás, neutros cálidos.
- **Dark es ahora el tema por defecto** (atmósfera "taller de noche"); el toggle claro y el
  alto-contraste siguen disponibles y derivan de los mismos tokens.

### Paleta dark congelada (resumen)
| Token | Hex | Uso |
|---|---|---|
| Canvas | `#0F1517` | fondo base |
| Panel | `#192123` | elevación media |
| Card / popup | `#222A2D` | elevación alta |
| Texto 1 / 2 / 3 | `#EDEBE7` / `#BAB7B0` / `#9E9B94` | primario / secundario / terciario |
| Borde hairline / fuerte | `#2F373A` / `#4F5A5D` | 1px / divisores marcados |
| **Acento (azul-acero)** | **`#33B6D1`** | tab activa, XP, agente trabajando, acción primaria |
| Acento texto | `#62CFE8` | texto/iconos de acento sobre canvas |
| OK / Warn / Danger / Info | `#5EC386` / `#EBB25F` / `#F36356` / `#5EB6E6` | éxito / revisión / **fallo** / informativo |

### Color por agente (idéntico en ambos temas)
Investigador `#60AD64` · PM `#A278E4` · Diseñador `#E9609E` · Arquitecto `#3D96EA` ·
Backend `#2CB3B4` · Frontend `#37B2E8` · Tester `#E39849` · Revisor `#46B68C` ·
Auditor seg. `#EC5C50`. (El gremio/operador usa el acento azul-acero.)

## 3. Tipografía y forma (congelado)
- **Display:** Space Grotesk · **Cuerpo:** Hanken Grotesk · **Mono:** JetBrains Mono.
- **Radios:** 8 / 12 / 16 px + pill. Esquinas amplias, layout aireado (`max-width` 1200px).
- `font-variant-numeric: tabular-nums` en todo número.

## 3b. Tiers de logros — estándar de rareza de videojuego
A pedido de Sergio, los tiers usan el **estándar de loot rarity** de la industria gamer
(gris → verde → azul → morado → naranja), que se lee al instante:

| Tier | Rareza | Hex (dark) |
|---|---|---|
| **Común** | gris | `#989FA8` |
| **Poco común** | verde | `#53BE70` |
| **Raro** | azul | `#339FEE` |
| **Épico** | morado | `#B474F4` |
| **Leyenda** | naranja | `#F68C36` |

Se renombraron los tiers (antes Bronce/Plata/Oro/Platino/Leyenda) para que el color y el
nombre sean coherentes; **Leyenda** se mantiene en la cima. El texto del badge es oscuro
sobre el relleno claro en dark (AA), blanco en light. El azul de rareza (hue 245) se separa
a propósito del acento azul-acero (hue 215) para no confundirse.

## 4. Lo que NO cambió (sigue mandando)
- 3 elevaciones, hairline 1px, espaciado en múltiplos de 0.25rem, base 16px.
- Fallo como estado de primera clase; estado nunca solo por color (icono+forma+etiqueta).
- Gamificación honesta (XP por trabajo verificable, celebración que escala, endowed
  progress, sin patrones tóxicos).
- Motion sobrio (`transform`/`opacity`, <300ms) + `prefers-reduced-motion`.
- Sprites y fondos de zona **fijos**; chrome enmarcándolos. `reviewer` y `security-auditor`
  sin fondo de zona → tinte de respaldo del color de rol.
- Accesibilidad: contraste AA verificado (acento sobre canvas 10.2:1; texto sobre acción
  primaria 7.9:1 en dark), `aria` en español, foco visible, teclado.

## 5. Pendientes abiertos (para cuando quieras seguir)
1. Pase **axe-core + Playwright** sobre la dirección congelada (375px / 1280px) — ver
   `a11y-report.md`.
2. Subir `.iconbtn` a **44×44** estricto (mínimo táctil).
3. ¿Quieres que **retire** los mockups de las otras dos direcciones (Pergamino, Cripta) y el
   hub comparativo, o los dejo archivados como referencia?
4. ¿Avanzamos a **UI kit de pantallas reales** a partir de Atelier dark (Mission Control,
   Workspace, Salón de logros como pantallas pulidas a página completa)?

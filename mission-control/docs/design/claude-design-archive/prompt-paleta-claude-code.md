# Prompt para Claude Code — Recolorear prototipos con la paleta "Atelier" de Pandacorp

> Copia TODO lo que está debajo de la línea y pégalo en Claude Code, dentro de tu proyecto
> de prototipos. Le dice exactamente qué colores usar y cómo aplicarlos.

---

Aplica esta paleta de diseño ("Atelier", tema oscuro por defecto) a mis prototipos. Define
los colores como CSS custom properties en `:root` y un bloque `[data-theme="light"]`, y
**reemplaza los colores hardcodeados** de mis archivos por estas variables. No inventes
colores nuevos: usa solo los de abajo. Conserva el layout y el contenido; solo cambia color.

## Reglas de uso (respétalas)
- **Tema por defecto: oscuro.** Soporta claro con `[data-theme="light"]` y respeta
  `prefers-color-scheme`.
- **3 niveles de elevación:** `--canvas` (fondo) → `--panel` → `--card`. Nunca uses un
  cuarto tono de gris arbitrario.
- **Un solo acento, racionado** (`--accent`): úsalo SOLO en lo importante — acción primaria,
  estado activo (tab/selección), foco, barra de progreso/XP. Una sola acción primaria por
  pantalla. Todo lo demás en neutros (`--t1/2/3`, bordes).
- **Texto:** `--t1` títulos/principal, `--t2` secundario, `--t3` terciario/sutil. Nunca
  texto bajo `--t3` para contenido legible.
- **Bordes:** `--bd` hairline 1px; `--bd2` divisores marcados.
- **Estados semánticos:** `--ok` éxito, `--warn` aviso, `--danger` error/destructivo,
  `--info` informativo. Cada uno tiene su `-bg` para fondos suaves.
- **Números:** añade `font-variant-numeric: tabular-nums` a todo número.
- **El acento es azul-acero (cyan-azulado).** No lo cambies a azul-violeta ni a gradientes.
- Si hay categorías/usuarios/agentes, usa la paleta categórica (`--cat-*`). Cada categoría
  mantiene su color en toda la UI. Nunca distingas estados solo por color: añade icono o
  etiqueta.
- Si hay niveles de rareza/dificultad/ranking, usa la escala de tiers (gris→verde→azul→
  morado→naranja).

## Tokens — pégalos tal cual

```css
:root {
  /* === TEMA OSCURO (por defecto) === */
  /* Superficies (3 elevaciones) */
  --canvas: #0F1517;
  --panel:  #192123;
  --card:   #222A2D;
  /* Texto */
  --t1: #EDEBE7;
  --t2: #BAB7B0;
  --t3: #9E9B94;
  /* Bordes */
  --bd:  #2F373A;   /* hairline 1px */
  --bd2: #4F5A5D;   /* divisor marcado */
  /* Acento (azul-acero) — racionado */
  --accent:      #33B6D1;
  --accent-text: #62CFE8;  /* texto/iconos de acento sobre fondos oscuros */
  --accent-bg:   #003542;  /* fondo suave de acento */
  --on-accent:   #071318;  /* texto sobre un relleno de --accent */
  /* Semánticos */
  --ok: #5EC386;      --ok-bg: #163A27;
  --warn: #EBB25F;    --warn-bg: #3A2E18;
  --danger: #F36356;  --danger-bg: #3A1A17;
  --info: #5EB6E6;    --info-bg: #14303D;
  /* Categorías / agentes (color persistente por categoría) */
  --cat-1: #60AD64;   /* verde     */
  --cat-2: #A278E4;   /* violeta   */
  --cat-3: #E9609E;   /* magenta   */
  --cat-4: #3D96EA;   /* azul      */
  --cat-5: #2CB3B4;   /* teal      */
  --cat-6: #37B2E8;   /* celeste   */
  --cat-7: #E39849;   /* ámbar     */
  --cat-8: #46B68C;   /* esmeralda */
  --cat-9: #EC5C50;   /* rojo      */
  /* Tiers / rareza (gris → verde → azul → morado → naranja) */
  --tier-1: #989FA8;  /* Común       */
  --tier-2: #53BE70;  /* Poco común  */
  --tier-3: #339FEE;  /* Raro        */
  --tier-4: #B474F4;  /* Épico       */
  --tier-5: #F68C36;  /* Leyenda     */
  /* Radios y forma */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-pill: 999px;
  /* Sombras */
  --shadow:     0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.35);
  --shadow-pop: 0 18px 50px rgba(0,0,0,.5);
}

[data-theme="light"] {
  /* === TEMA CLARO === */
  --canvas: #F8F7F3;
  --panel:  #FEFDFA;
  --card:   #FFFFFF;
  --t1: #25211B;
  --t2: #5C5751;
  --t3: #736E67;
  --bd:  #E0DEDA;
  --bd2: #C1BDB7;
  --accent:      #007890;
  --accent-text: #00637B;
  --accent-bg:   #D5F5FD;
  --on-accent:   #FEFCF4;
  --ok: #177C49;      --ok-bg: #DEFAE6;
  --warn: #A36D24;    --warn-bg: #FFEECD;
  --danger: #BE3029;  --danger-bg: #FFE8E3;
  --info: #1C719A;    --info-bg: #DFF6FF;
  --cat-1: #3E8343; --cat-2: #784DB6; --cat-3: #BF397A; --cat-4: #006BBB; --cat-5: #008081;
  --cat-6: #0086BE; --cat-7: #BB731B; --cat-8: #158561; --cat-9: #C83B32;
  --tier-1: #757B81; --tier-2: #1C8742; --tier-3: #006EB8; --tier-4: #7C3EB3; --tier-5: #C26300;
  --shadow:     0 1px 2px rgba(40,35,28,.05), 0 8px 24px rgba(40,35,28,.07);
  --shadow-pop: 0 16px 48px rgba(40,35,28,.18);
}
```

## Mapeo sugerido (cómo traducir lo que ya tengo)
- Fondo de página → `--canvas`. Tarjetas/secciones → `--panel` o `--card`.
- Texto principal → `--t1`; subtítulos/labels → `--t2`; placeholders/sutil → `--t3`.
- Botón primario → `background: var(--accent); color: var(--on-accent)`.
- Botón secundario → `background: var(--card); color: var(--t1); border: 1px solid var(--bd2)`.
- Links/iconos activos → `--accent-text`. Foco → `outline: 2px solid var(--accent)`.
- Badges de éxito/error/aviso → `color: var(--ok|danger|warn)` sobre su `-bg`.
- Bordes/separadores → `1px solid var(--bd)`.
- Tipografía sugerida (si me sirve): display **Space Grotesk**, cuerpo **Hanken Grotesk**,
  mono **JetBrains Mono** (Google Fonts). Si no, deja mis fuentes.

Cuando termines, dime qué archivos tocaste y enséñame el antes/después de un componente.

---

### Tabla de referencia rápida (para humanos)

| Rol | Oscuro | Claro |
|---|---|---|
| Canvas / Panel / Card | `#0F1517` · `#192123` · `#222A2D` | `#F8F7F3` · `#FEFDFA` · `#FFFFFF` |
| Texto 1 / 2 / 3 | `#EDEBE7` · `#BAB7B0` · `#9E9B94` | `#25211B` · `#5C5751` · `#736E67` |
| **Acento (azul-acero)** | **`#33B6D1`** | **`#007890`** |
| OK / Warn / Danger / Info | `#5EC386` · `#EBB25F` · `#F36356` · `#5EB6E6` | `#177C49` · `#A36D24` · `#BE3029` · `#1C719A` |
| Tiers (Común→Leyenda) | `#989FA8` `#53BE70` `#339FEE` `#B474F4` `#F68C36` | `#757B81` `#1C8742` `#006EB8` `#7C3EB3` `#C26300` |

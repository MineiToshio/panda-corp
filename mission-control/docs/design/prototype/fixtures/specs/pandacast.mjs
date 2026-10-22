// PandaCast — a fictional cross-posting tool in the architecture phase: it has its PRD, research
// and four FRD contracts, but no architecture digest, blueprints, data model or work orders yet.
import { frontmatter } from "./common.mjs";

const frds = [
  { n: 1, slug: "frd-01-creator-sign-in", en: "Creator sign-in", es: "Acceso del creador", tag: "UI", wos: [], reqs: ["sign-in with a single email link", "the list of connected platforms after sign-in"] },
  { n: 2, slug: "frd-02-platform-links", en: "Platform connections", es: "Conexiones con plataformas", tag: "UI", wos: [], reqs: ["connecting a platform account", "the health of each connection"] },
  { n: 3, slug: "frd-03-video-dashboard", en: "Video dashboard", es: "Panel de videos", tag: "UI", wos: [], reqs: ["the latest source videos", "the publishing state per platform"] },
  { n: 4, slug: "frd-04-crosspost-engine", en: "Cross-posting engine", es: "Motor de publicación cruzada", tag: "Infra", wos: [], reqs: ["detecting a new source video", "retrying a failed publication"] },
];

const specDigest = `${frontmatter([["proyecto", "PandaCast"], ["fase", "producto"]])}

> Publicas un video corto una vez y PandaCast lo lleva a tus otras redes con el formato correcto, sin volver a subirlo a mano.

## 📋 PRD

### El problema
- **Subir cinco veces** — cada red pide su propio formato, texto y portada.
- **Se olvida una** — siempre queda una red sin el video de la semana.
- **Sin visión de conjunto** — no hay un lugar para ver qué se publicó dónde.

### Hipótesis de valor
Si publicar en todas las redes no cuesta más que publicar en una, el creador mantiene su ritmo en todas.

### Usuarios
- **Creador independiente** — publica de tres a cinco videos por semana y lo hace todo solo.

### Métricas de éxito
- **Publicaciones automáticas** — 80 % de los videos llegan a todas las redes sin intervención.
- **Tiempo ahorrado** — al menos 2 horas por semana según el propio creador.
- **Conexiones sanas** — 95 % de las conexiones activas sin error en la semana.

### Alcance v1
- Acceso con enlace por correo
- Conectar redes
- Detectar videos nuevos
- Publicar con el formato de cada red
- Panel de estado

### Fuera del v1
- Edición de video
- Programación de publicaciones
- Analítica de audiencia
- Equipos con varios usuarios
- App nativa

### Decisiones abiertas
- **Primera red de origen** — ¿se empieza por una sola red de origen?
- **Credenciales** — ¿cómo se guardan y rotan los tokens de cada red?
- **Coste del trabajador** — ¿un trabajador siempre encendido o bajo demanda?

## 🔬 Research

### Hallazgo clave
Los creadores pequeños abandonan una red no por falta de audiencia sino por el trabajo repetido de subir el mismo video.

### El diferenciador
Respeta el formato de cada red (texto, portada, duración) en lugar de copiar el mismo archivo a todas.

### Referentes
- **Programadores de redes sociales** — pensados para equipos y para texto, no para video corto.
- **Atajos de automatización** — frágiles cuando una red cambia su API.
- **Subida manual** — la opción más usada y la que más tiempo cuesta.

## 🧩 FRDs

### FRD-01 · Acceso del creador · UI
Entrar con un enlace por correo.
**Resumen:** un único creador por cuenta; el acceso es simple y sin contraseña.
**Historias de usuario:**
- Como creador quiero entrar con un enlace por correo.
- Como creador quiero ver mis redes conectadas al entrar.
**Reglas de negocio:**
- El enlace caduca a los 15 minutos.
- Una cuenta tiene un solo creador.
**Fuera de alcance:**
- Equipos.
- Inicio con redes sociales.
**Preguntas abiertas:**
- ¿Hace falta verificar el correo antes de conectar redes?

### FRD-02 · Conexiones con plataformas · UI
Conectar cada red y ver si sigue funcionando.
**Resumen:** cada conexión muestra su estado y avisa antes de caducar.
**Historias de usuario:**
- Como creador quiero conectar una red en tres pasos.
- Como creador quiero saber cuándo una conexión dejó de funcionar.
**Reglas de negocio:**
- Las credenciales se guardan cifradas.
- Una conexión caducada pausa sus publicaciones.
- El creador puede desconectar una red en cualquier momento.
**Fuera de alcance:**
- Varias cuentas de la misma red.
- Redes sin API pública.
**Preguntas abiertas:**
- ¿Con qué frecuencia se revisa la salud de cada conexión?

### FRD-03 · Panel de videos · UI
Ver los videos recientes y su estado en cada red.
**Resumen:** un tablero simple: una fila por video, una columna por red.
**Historias de usuario:**
- Como creador quiero ver qué video falta en qué red.
- Como creador quiero reintentar una publicación fallida.
**Reglas de negocio:**
- El panel se actualiza solo mientras está abierto.
- Un fallo muestra su causa en palabras simples.
- Los videos se ordenan del más reciente al más antiguo.
**Fuera de alcance:**
- Métricas de reproducciones.
- Edición del texto desde el panel.
**Preguntas abiertas:**
- ¿Cuántos videos se muestran antes de paginar?

### FRD-04 · Motor de publicación cruzada · Infra
Detectar videos nuevos y publicarlos con el formato de cada red.
**Resumen:** corre en segundo plano y reintenta con espera creciente.
**Historias de usuario:**
- Como creador quiero que un video nuevo llegue a todas mis redes sin tocar nada.
- Como creador quiero que un fallo se reintente solo.
**Reglas de negocio:**
- Cada publicación es idempotente.
- Se reintenta como máximo cinco veces.
- Un fallo definitivo queda visible en el panel.
**Fuera de alcance:**
- Programar publicaciones a futuro.
- Recortar o editar el video.
**Preguntas abiertas:**
- ¿Se publica en paralelo o en orden fijo?
- ¿Qué pasa si la red de origen borra el video?`;

const docs = {
  "docs/product/prd.md": `# PRD — PandaCast

Publish a short video once and have it reach every other network in the right format. Single creator per account; no editing, no scheduling in v1.`,
  "docs/product/research.md": `# Research — PandaCast

Small creators drop networks because of repeated uploads, not lack of audience. Social schedulers target teams and text; automation shortcuts break when an API changes.`,
  "docs/decision-log.md": `# Decision log — PandaCast

- **2026-10-12** — Product phase closed; four FRDs approved.
- **2026-10-14** — Design approved after three rounds.`,
  "DESIGN.md": `# Design — PandaCast

A dark, high-contrast control room. One row per video, one column per network, status as text and icon.`,
  "docs/design/components.md": `# Component inventory — PandaCast

| Component | Notes |
|---|---|
| NetworkCell | status icon + label |
| ConnectionCard | health and expiry |`,
  "docs/design/voice-and-tone.md": `# Voice and tone — PandaCast

Short, calm, practical. Errors explain what happened and what to do next.`,
  "docs/design/a11y-report.md": `# Accessibility report — PandaCast

All screens pass the automated checks; status never relies on colour alone.`,
};

export const pandacast = {
  id: "pandacast",
  srcRoot: "src/app",
  plannedOn: "2026-10-14",
  frds,
  blueprints: false,
  status: `# Machine-readable status for PandaCast.
project: "PandaCast"
phase: architecture
version: v1
overlay_version: "8.98.0"
created_with: "8.90.0"
target_platforms: responsive
running: false
updated_at: "2026-10-19T05:40:00Z"
repo: ""
last_green_sha: ""
safe_to_test: false
rethink_pending: false
advance_pending: false
`,
  specDigest,
  services: {
    schema_version: 1, project_id: "pandacast", resource_slug: "pandacast",
    services: {
      web: { provider_id: "vercel", account_ref: "vercel-main", status: "proposed", environments: { prod: { resource_name: "pandacast" } } },
      database: { provider_id: "neon", account_ref: "neon-main", status: "proposed", environments: { dev: { resource_name: "pandacast / dev" }, prod: { resource_name: "pandacast / prod" } } },
      worker: { provider_id: "railway", account_ref: "railway-main", status: "proposed", environments: { prod: { resource_name: "pandacast-worker" } } },
      email: { provider_id: "resend", account_ref: "resend-main", status: "proposed", environments: { prod: { resource_name: "cast.example.com" } } },
      errors: { provider_id: "sentry", account_ref: "sentry-main", status: "proposed", environments: { prod: { resource_name: "pandacast" } } },
      ci: { provider_id: "github", account_ref: "github-main", status: "proposed", environments: { prod: { resource_name: "example-org/pandacast" } } },
      cache: { provider_id: "upstash", account_ref: null, status: "proposed", environments: {} },
    },
  },
  docs,
};

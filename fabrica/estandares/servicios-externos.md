# Servicios externos, cuentas y secretos

Cómo la fábrica gestiona los servicios SaaS externos (storage, DB, email, pagos, analítica), el **modelo de cuentas**, los **secretos** y el **aprovisionamiento**. Complementa `stack.md` (qué servicios) e `infra.md` (dev local). Decisiones: DR-035..DR-038. Stack base validado en producción por **PandaTrack**.

## 1. Stack estándar de servicios (probado)

| Categoría | Servicio estándar | Modelo de cuenta | Separación por app |
|---|---|---|---|
| Hosting / deploy | **Vercel** (1 team) | 1 team → 1 proyecto/app | Proyecto + env vars |
| DB Postgres | **Neon** (Prisma + `adapter-pg`) | 1 cuenta → 1 proyecto/app (hasta 100 free) | DB física aislada |
| Auth | **Better Auth** self-hosted (+ OAuth Google) | en la DB Neon del app | Tablas en su DB + 1 OAuth client/app |
| Storage archivos/fotos | **Cloudflare R2** (SDK S3) | 1 cuenta → 1 bucket/app | Bucket + token con scope al bucket |
| Email transaccional | **Resend** | 1 cuenta → 1 dominio/app | Dominio verificado + API key |
| Email marketing / waitlist | **Kit** (ConvertKit) | 1 cuenta → tags/forms por app | Tag/form por app |
| Captura de waitlist | **Google Apps Script + Sheet** | 1 cuenta Google → 1 sheet/app | Sheet por app |
| Errores | **Sentry** | 1 org → 1 proyecto/app | Proyecto Sentry |
| Analítica producto | **PostHog Cloud** | 1 **organización** por app | Cada org free: 1M eventos/mes + 1 proyecto |
| Pagos | **Polar** (Merchant of Record) | 1 cuenta → 1 producto/app | Producto/organización por app |

Es el default probado. El `architect` puede desviarse con ADR per-proyecto (DR-030), pero las categorías de estado (DB, storage, email, pagos) se mantienen salvo razón fuerte.

## 2. Modelo de cuentas: el principio

- Separa **cuenta** (facturación/identidad) de **aislamiento** (el primitivo del proveedor + credencial con scope). El aislamiento NO viene de tener cuentas separadas: viene de un proyecto Neon (= DB física aislada), un bucket R2, un dominio Resend, una org PostHog, un producto Polar, cada uno con su credencial.
- **Default: UNA cuenta/org compartida por servicio, separando cada app por su primitivo nativo.** Una cuenta con N proyectos aislados da el mismo aislamiento que N cuentas, sin la pesadilla operativa — y es suficiente para producción real con datos personales (GDPR).
- **Regla "org/proyecto gratis SÍ, cuenta-títere NO":** usar la separación que el proveedor ofrece (orgs de PostHog, proyectos de Neon) es legítimo. Crear múltiples cuentas con `+alias` para esquivar un tope de free tier (p. ej. Supabase = 2 proyectos) **viola los ToS** y arriesga baneos que tumban apps vivas. Test: *"¿uso una función que ofrecen, o evado un cobro que pusieron?"* Por eso se elige Neon (100 proyectos/cuenta) sobre Supabase para el modelo multi-app.
- **Cuándo aislar en una cuenta propia** (no solo un proyecto): es un **hito de éxito**, no el default — (a) aislar billing (la app gana dinero / se va a vender), (b) blast-radius (demasiado importante para compartir suerte con las demás), o (c) un límite duro que no se levanta pagando. Hasta entonces se queda en la cuenta compartida. La migración es barata porque el primitivo ya es un silo autocontenido (un proyecto Neon, un bucket R2 se levantan y se llevan).
- **Escalar (crecer) ≠ migrar:** cada app cruza de free→pago **en su propio primitivo, en el sitio**, sin tocar las demás (subir cómputo del proyecto Neon, pagar storage R2 sobre 10 GB, plan Resend mayor, org PostHog que cruza 1M eventos). No se rehace nada.

## 3. Aprovisionamiento: API-first

- Por defecto, crear/destruir recursos por **API/CLI**, no clickeando dashboards. Casi todo el stack lo soporta: Neon (API+CLI), Cloudflare R2 (API+Wrangler), Vercel (API+CLI), Resend (API; DNS automático si el dominio vive en Cloudflare), Polar (API), Sentry (API), PostHog (API). Headless = sin CAPTCHA/2FA, reanudable, autónomo. **Eso** es lo que permite "dejarlo corriendo".
- **Fallback navegador** (Claude-in-Chrome) solo para el raro proveedor sin API: el agente **verifica la cuenta activa** (screenshot del email logueado) contra la esperada del proyecto ANTES de actuar, para no crear recursos en la cuenta equivocada.
- **Gates humanos inevitables** (y deseados): signup de cuenta nueva (CAPTCHA/verificación email), meter tarjeta (= DR-005), 2FA en dashboards. En esos puntos el agente **notifica al dueño (DR-038) y se detiene**. Los tokens de API esquivan login+2FA por completo; donde no hay API, se acepta el toque humano (no se guarda el seed TOTP — degradaría el 2FA).

## 4. Secretos y credenciales

Dos planos separados:

- **Runtime** → el `.env` de cada proyecto (gitignored). `.env.example` documenta las variables sin valores (constitución §12, `seguridad-web.md`).
- **Store de máquina** (lo que el agente lee sin el dueño presente) → **SOPS + age**: archivo cifrado **fuera de todo repo** (ej. `~/.config/pandacorp/secrets/`), con la llave privada `age` en el **Keychain de macOS**. SOPS cifra solo los *valores* (la estructura queda legible). Guarda: tokens de API de proveedores (para aprovisionar), credenciales generadas por app, y —como fallback— logins de dashboards sin API.
- **LastPass = solo lo personal del dueño**, separado del store de máquina. Patrón recomendado: gestor humano interactivo ≠ store de máquina no interactivo. Alternativas válidas al store: Infisical (open-source, con auditoría), Bitwarden Secrets Manager, 1Password Service Accounts.
- **Honestidad de modelo de amenaza:** el cifrado en reposo protege contra filtración (git/backup/disco robado), **NO contra compromiso local** — porque la llave debe estar al alcance del agente. Es el trade inherente a la autonomía. Mitigaciones: tokens con **privilegio mínimo** (scope por proyecto, no admin de cuenta), store separado de lo personal, y los gates destructivos (DR-004/005/007/008) siguen exigiendo al dueño aunque el agente opere desatendido.

## 5. Pagos — Polar (Merchant of Record)

- **Por qué MoR:** el dueño está en **Perú**, donde Stripe directo no opera (requeriría una LLC en EE.UU.). Un Merchant of Record es el **vendedor legal**: cobra global, maneja IVA/impuestos y compliance, y **paga al dueño en Perú**.
- **Estándar: Polar** — Perú soportado para payout (vía Stripe Connect Express), fees ~4% + $0.40, enfocado a developers, multi-producto. Respaldo: Lemon Squeezy (paga vía PayPal; roadmap incierto tras la compra por Stripe).
- **Modelo de cuenta:** 1 cuenta Polar → **1 producto/organización por app**.
- **Integración:** Polar no reemplaza a Better Auth (identidad). El cobro es checkout Polar → **webhook** → la DB Neon del app marca al usuario como pagado. Variables `POLAR_*` en `.env`.
- **"¿v1 incluye pagos?"** se decide explícitamente en el PRD (ver §6 y DR-035).

## 6. Vercel: uso comercial = Pro (warning, NUNCA bloqueo)

- Hobby (gratis) es **no comercial**: cualquier cobro, anuncio o **donación** cuenta como comercial. Una suspensión es de **cuenta COMPLETA** (todas las apps adentro), sin aviso garantizado.
- **Pro:** $20/mes por **seat** (no por proyecto), cubre proyectos ilimitados del team + $20 de crédito de uso incluido. **Un seat = toda la fábrica.**
- **Regla (DR-035): NO bloquear el trabajo por esto.** La fábrica solo **AVISA** (warning) cuando una versión va a cobrar dinero, en 3 momentos: al definir el PRD, en el blueprint (plan de hosting) y en el release (antes del deploy). El dueño decide *continuar o detener*. No es un gate.
- Estructura: **un solo team Pro** para todas las apps lanzadas; el día que una app enciende pagos va al team Pro (no esperar el email de Vercel, porque el ban es de cuenta completa).

## 7. Notificación al dueño en gates (DR-038)

- En **CUALQUIER** punto que requiera decisión/acción del dueño (gates DR-004/005/007/008/035, pendientes del skill `decide`, o signup/2FA/pago durante el aprovisionamiento), el agente dispara una **notificación push**. Llega al **celular** si Remote Control / la app de Claude está conectada a la sesión (ya configurados en la máquina del dueño). Mensaje de una línea, accionable: *"PandaTrack: meter tarjeta en Polar para continuar"*.
- El **cockpit** (Mission Control) es la vista "en el escritorio" (log de pendientes en `docs/estado.yaml`); el **push** es la vista "estoy fuera". No se conecta el cockpit al celular — el push nativo lo cubre.

## 8. Playbook — alta y baja de un proyecto

Convención de nombre en todos los servicios: **`pandacorp-<slug>`**. Todo por API donde exista; lo que no, navegador con verificación de cuenta + push en gates.

**ALTA:**
1. **Neon**: crear proyecto → connection string → migraciones de Better Auth.
2. **R2** (si usa archivos/fotos): bucket + token con scope al bucket.
3. **Vercel**: proyecto en el team. Hobby si es pre-lanzamiento sin monetizar; team **Pro** al monetizar (DR-035).
4. **Resend** (si manda email): dominio verificado.
5. **Kit** (si capta audiencia): tag/form por app.
6. **Polar** (si cobra): producto.
7. **Sentry**: proyecto. **PostHog**: organización.
8. **Secretos**: tokens y credenciales al store SOPS+age; `.env` del proyecto cableado desde ahí.

**BAJA** (cada app es un silo → borrar una NO toca las otras):
1. Exportar si se conserva (pg_dump Neon, copia del bucket R2).
2. Borrar proyecto Neon (DB + datos de Better Auth = borrado GDPR real).
3. Borrar bucket R2 + revocar su token.
4. Borrar proyecto Vercel + dominios.
5. Quitar dominio en Resend, organización en PostHog, proyecto en Sentry, producto en Polar.
6. Borrar las entradas del store de secretos.

> Borrar recursos cloud = **DR-007** (gate humano + push DR-038).

## 9. Setup operativo del store SOPS+age

**Una sola vez** (máquina del dueño):
1. `brew install sops age`.
2. Generar la llave: `age-keygen -o ~/.config/pandacorp/age/keys.txt` → produce una clave **pública** (cifra) y una **privada** (descifra). `chmod 600` al archivo.
3. Decirle a SOPS dónde está la llave: `export SOPS_AGE_KEY_FILE=~/.config/pandacorp/age/keys.txt` (en el shell/launchd del dueño), o guardar la privada en el **Keychain de macOS** y exportarla a `SOPS_AGE_KEY` al abrir sesión.
4. Crear `~/.config/pandacorp/.sops.yaml` con `creation_rules` que cifren con la clave pública age todos los `*.sops.yaml` del store.
5. Layout (FUERA de todo repo): `~/.config/pandacorp/secrets/providers.sops.yaml` (tokens de API de proveedores) + `~/.config/pandacorp/secrets/apps/<slug>.sops.yaml` (credenciales por app).

**Uso por el agente** (no interactivo, con la sesión del Mac abierta):
- Leer: `sops -d <archivo>.sops.yaml`. Inyectar a un proceso: `sops exec-env <archivo>.sops.yaml '<comando>'`. Editar: `sops <archivo>.sops.yaml` (abre en claro, re-cifra al guardar).

**Qué guarda:**
- `providers.sops.yaml`: tokens de API (privilegio mínimo) de Neon, Cloudflare, Vercel, Resend, Polar, Sentry, PostHog + credenciales OAuth base. Es lo que permite el aprovisionamiento headless (§3).
- `apps/<slug>.sops.yaml`: espejo del `.env` del app (`DATABASE_URL`, `ASSETS_STORAGE_*`, `RESEND_API_KEY`, `POLAR_*`…).
- Fallback: logins de dashboards de proveedores sin API.

**Seguridad y respaldo:**
- Tokens con scope por proyecto; rotar si se filtran; nunca al repo (ni siquiera el archivo cifrado, por convención).
- **Respaldo de la llave privada age = crítico**: si se pierde, el store es irrecuperable. Respaldarla por separado (única excepción aceptable: una entrada en el LastPass personal del dueño, o copia offline). La pública puede ir en claro.

## 10. Fundamentos (hechos verificados que respaldan estas decisiones)

Verificado a **2026-06**; los free tiers cambian — re-verificar antes de tratarlos como números duros.

- **Neon** Free: hasta **100 proyectos/cuenta**, cada proyecto = DB aislada. Por eso es el estándar multi-app (vs **Supabase** Free = 2 proyectos activos/org, que forzaría multicuenta).
- **Cloudflare R2**: 10 GB gratis + **egress gratis**; API tokens con **scope a un bucket**.
- **Vercel**: Pro = **USD 20/seat** (no por proyecto), proyectos ilimitados + USD 20 de crédito; Hobby = **no comercial**, y la suspensión es de **cuenta COMPLETA sin aviso garantizado**.
- **PostHog**: Free = **1M eventos/mes + 1 proyecto por organización**; el billing es **por organización** → varias orgs (un login) = varios free tiers. Por eso "1 org por app" en vez de pagar por proyectos extra.
- **Multicuenta con `+alias`** para esquivar topes de free tier = **viola los ToS** (Vercel, Supabase) → prohibido (≠ usar orgs/proyectos que el proveedor sí ofrece como función legítima).
- **Pagos desde Perú**: Stripe directo no opera en Perú (requeriría LLC en EE.UU.) → **Merchant of Record**. **Polar** soporta payout a Perú (Stripe Connect Express), fees ~4% + USD 0.40; respaldo Lemon Squeezy.

---

Cross-refs: `stack.md` (qué servicios), `infra.md` (dev local/Docker/puertos), `seguridad-web.md` (secretos), `privacidad.md` (PII/GDPR), `observabilidad.md` (Sentry/logs). Decisiones: DR-035 (Vercel/pagos), DR-036 (servicios estándar + modelo de cuenta), DR-037 (secretos + aprovisionamiento), DR-038 (notificación en gates).

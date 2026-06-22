---
title: "Servicios, cuentas y secretos"
group: concepts
order: 15
---

# Servicios, cuentas y secretos

Cuando una app necesita base de datos, correo, pagos o analítica, la fábrica no inventa: usa un **stack de servicios probado**, un **modelo de cuentas** que da aislamiento sin pesadilla operativa, y guarda los **secretos cifrados fuera de todo repo**.

## El stack de servicios (probado)

| Para qué | Servicio |
|---|---|
| Base de datos (Postgres) | **Neon** |
| Almacenamiento de ficheros/fotos | **Cloudflare R2** |
| Correo transaccional | **Resend** |
| Correo marketing / lista de espera | **Kit** |
| Errores | **Sentry** |
| Analítica de producto | **PostHog** |
| Pagos | **Polar** |

## El modelo de cuentas

**Por defecto: UNA cuenta/org compartida por servicio, separando cada app por su primitivo nativo.** El aislamiento NO viene de tener cuentas separadas: viene de un **proyecto de Neon** (= BD física aislada), un **bucket de R2**, un **dominio de Resend**, una **org de PostHog**, un **producto de Polar** — cada uno con su propia credencial. Una cuenta con N proyectos aislados da el mismo aislamiento que N cuentas, sin la pesadilla operativa, y basta para producción real con datos personales (GDPR).

> **Regla "free org SÍ, cuenta-títere NO".** Usar la separación que el proveedor ofrece (orgs de PostHog, proyectos de Neon) es legítimo. Crear varias cuentas con `+alias` para esquivar un tope del free-tier **viola los términos de servicio** y arriesga baneos que tumban apps vivas.

## Los secretos (cifrados, fuera de todo repo)

Los secretos viven en **dos planos**:

- **Runtime** — en el `.env` del proyecto (gitignored; `.env.example` sin valores).
- **Almacén de máquina** (lo que el agente lee sin ti presente) → **SOPS + age**: un fichero cifrado **fuera de cualquier repo** (p. ej. `~/.config/pandacorp/secrets/`), con la **clave privada `age` en el Keychain de macOS**. SOPS cifra solo los *valores* (la estructura queda legible).

Nunca van secretos al código ni al contexto de los agentes (DR-037).

## Pagos desde Perú (Merchant of Record)

El dueño está en **Perú**, donde Stripe directo no opera (requeriría una LLC en EE. UU.). Un **Merchant of Record** es el **vendedor legal**: cobra globalmente, gestiona IVA/impuestos y compliance, y **te paga en Perú**. El estándar es **Polar** (payout a Perú vía Stripe Connect Express, comisiones ~4% + $0.40, enfocado a developers).

## El aviso de Vercel Pro

Vercel Hobby (gratis) es **no comercial**: cualquier cobro, anuncio o **donación** cuenta como comercial. Si una versión cobra dinero, requiere **Vercel Pro** ($20/mes por asiento — un asiento = toda la fábrica). **No bloquea el trabajo** (no es un gate): la fábrica solo **AVISA** cuando una versión va a cobrar, en 3 momentos —al definir el PRD, en el blueprint (plan de hosting) y en el release (antes del deploy) (DR-035).

## Push al celular en cada gate

En **cualquier** punto que requiera una decisión/acción tuya (gates DR-004/005/007/008/035, pendientes del skill `decide`, o un signup/2FA/pago durante el aprovisionamiento), el agente dispara una **notificación push**. Llega al **celular** si Remote Control / la app de Claude está conectada a la sesión, con un mensaje de una línea y accionable (p. ej. *"PandaTrack: mete la tarjeta en Polar para continuar"*), **además** de dejar el pendiente por archivo (DR-038).

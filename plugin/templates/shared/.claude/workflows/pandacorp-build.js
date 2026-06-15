export const meta = {
  name: 'pandacorp-build',
  description: 'Motor de construcción Pandacorp: olas de work orders (build → review → verify) con los subagentes de la fábrica, gates fail-closed y un commit por punto seguro. Reanudable y agnóstico de la app — trabaja sobre la cola de work orders y el verify.sh del proyecto, no sobre nada hardcodeado del producto.',
  phases: [
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

// ── Entrada (todo opcional) ──────────────────────────────────────────────────
//   args.mode: 'pro' | 'equilibrado' | 'potente' | 'profundo'  (default: equilibrado)
//   args.workOrders: ids específicos a construir (default: todos los pendientes)
const MODE = (args && args.mode) || 'equilibrado'
const ONLY = (args && args.workOrders) || null

// Concurrencia y modelos por modo (DR-014). La concurrencia REAL la limita el
// runtime (min(16, cores-2)); `wave` controla cuántos work orders independientes
// metemos por ola, `split` si se divide en backend/frontend/test o va un solo
// implementer, y `deepReview` corre las 3 lentes del reviewer en paralelo.
const PROFILES = {
  pro:         { wave: 1, worker: 'sonnet', judge: 'sonnet', split: false, deepReview: false },
  equilibrado: { wave: 3, worker: 'sonnet', judge: 'opus',   split: true,  deepReview: false },
  potente:     { wave: 5, worker: 'sonnet', judge: 'opus',   split: true,  deepReview: false },
  profundo:    { wave: 5, worker: 'opus',   judge: 'opus',   split: true,  deepReview: true  },
}
const P = PROFILES[MODE] || PROFILES.equilibrado
log(`Modo ${MODE} · ola ≤${P.wave} · obreros ${P.worker} · juicio ${P.judge}`)

// Cada subagente deja constancia para Party: un append fire-and-forget
// a ~/.claude/dashboard-events.ndjson (no bloquea, no llama a Claude). El estado
// "done" lo emite el hook SubagentStop de la fábrica cuando el subagente termina.
const EMIT = (role, wo) =>
  `Antes de empezar, registra tu actividad para Party (un append, fire-and-forget):\n` +
  `  printf '{"event":"AgentWorking","at":"%s","data":{"role":"${role}","wo":"${wo}"}}\\n' "$(date -u +%FT%TZ)" >> ~/.claude/dashboard-events.ndjson\n`

// ── Esquemas ────────────────────────────────────────────────────────────────
const PLAN_SCHEMA = {
  type: 'object',
  required: ['stack', 'hasFrontend', 'workOrders'],
  properties: {
    stack: { type: 'string', description: 'A (web) | B/C (API) | D (scraper/datos)' },
    hasFrontend: { type: 'boolean', description: 'true solo si el stack es web (A)' },
    trivial: { type: 'boolean', description: 'un solo módulo, sin separación back/front clara' },
    workOrders: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'summary', 'deps'],
        properties: {
          id: { type: 'string' },
          summary: { type: 'string' },
          deps: { type: 'array', items: { type: 'string' }, description: 'ids que deben estar en verde antes' },
          frd: { type: 'string' },
        },
      },
    },
  },
}
const STAGE_SCHEMA = {
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean' }, notes: { type: 'string' } },
}
const VERIFY_SCHEMA = {
  type: 'object',
  required: ['green'],
  properties: {
    green: { type: 'boolean' },
    sha: { type: 'string', description: 'commit del punto seguro si green' },
    failure: { type: 'string' },
  },
}

// ── Plan: leer la cola y el stack (estado en archivos del proyecto) ──────────
phase('Plan')
const plan = await agent(
  `Eres el planificador del build de Pandacorp. Lee el estado del proyecto SIN modificar nada:
  - docs/work-orders/README.md y docs/work-orders/*.md → la cola, su orden y dependencias.
  - docs/estado.yaml → qué ya está en verde (no lo re-construyas).
  - docs/blueprint.md → el stack elegido.
  Devuelve los work orders PENDIENTES en orden de dependencias, cada uno con sus deps (ids de work orders que deben estar en verde antes).${ONLY ? ' Limita a estos ids: ' + ONLY.join(', ') + '.' : ''}
  hasFrontend=true solo si el stack es web (A). trivial=true si es un solo módulo sin separación back/front.`,
  { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA, model: P.judge, agentType: 'pandacorp:architect' }
)

if (!plan || !plan.workOrders || plan.workOrders.length === 0) {
  log('Cola vacía: no hay work orders pendientes.')
  return { mode: MODE, built: [], blocked: [], note: 'cola vacía' }
}
log(`${plan.workOrders.length} work orders pendientes · stack ${plan.stack}${plan.hasFrontend ? ' (web)' : ''}`)

// ── Etapas por work order ────────────────────────────────────────────────────
const done = new Set()      // ids cerrados en verde
const blocked = new Set()   // ids BLOQUEADOS (freeze-on-red o dependencia muerta)
const built = []

async function build(wo) {
  // Trivial o modo pro: un solo implementer full-stack (dividir no aporta velocidad).
  if (plan.trivial || !P.split) {
    await agent(`${EMIT('implementer', wo.id)}Implementa COMPLETO el work order ${wo.id} con TDD (RED→GREEN→refactor), anclado en los criterios EARS del FRD ${wo.frd || ''} y en bugs de docs/progreso.md: ${wo.summary}. Escribe el contexto crítico a archivos.`,
      { label: `build:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: STAGE_SCHEMA })
    return
  }
  // Stack dividido: test RED → backend (+contrato) → frontend (si web).
  await agent(`${EMIT('test-writer', wo.id)}Escribe los tests de aceptación (fase RED) del work order ${wo.id} anclados en los criterios EARS del FRD ${wo.frd || ''}: ${wo.summary}. No escribas código de producción.`,
    { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
  await agent(`${EMIT('backend-dev', wo.id)}Implementa el backend del work order ${wo.id} con TDD hasta poner verdes los tests: ${wo.summary}. Publica el contrato de API en docs/api.md.`,
    { label: `be:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:backend-dev' })
  if (plan.hasFrontend) {
    await agent(`${EMIT('frontend-dev', wo.id)}Implementa la UI del work order ${wo.id} usando SOLO design tokens y consumiendo el contrato de docs/api.md: ${wo.summary}.`,
      { label: `fe:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:frontend-dev' })
  }
}

async function review(wo) {
  // El reviewer es de modelo distinto al generador (DR-015) y re-verifica él mismo.
  if (P.deepReview) {
    const lenses = ['correctitud', 'seguridad', 'calidad']
    const verdicts = await parallel(lenses.map((L) => () =>
      agent(`${EMIT('reviewer', wo.id)}Revisa el work order ${wo.id} con la lente de ${L}. Re-corre la evidencia tú mismo y escribe tests adversariales que el implementer no vio (anclados en EARS y bugs reales). Devuelve ok=false si encuentras un defecto real.`,
        { label: `rev:${wo.id}:${L}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer', schema: STAGE_SCHEMA })))
    if (verdicts.filter(Boolean).some((v) => v && v.ok === false)) throw new Error('REVIEW_REJECT: lente en rojo')
    return
  }
  const v = await agent(`${EMIT('reviewer', wo.id)}Revisa el work order ${wo.id} con tus 3 lentes (correctitud/seguridad/calidad). Re-corre tests/lint/typecheck tú mismo (no confíes en el auto-reporte) y escribe tests adversariales que el implementer no vio. Devuelve ok=false con el motivo si algo no cumple.`,
    { label: `rev:${wo.id}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer', schema: STAGE_SCHEMA })
  if (v && v.ok === false) throw new Error('REVIEW_REJECT: ' + (v.notes || 'reviewer rechazó'))
}

async function verifyWO(wo) {
  return await agent(`Punto seguro del work order ${wo.id}: corre .pandacorp/verify.sh en limpio. Si pasa (verde), commitea el work order (Conventional Commits con scope), marca el WO 'terminado' con evidencia en docs/work-orders/, y escribe en docs/estado.yaml el last_green_sha (sha del commit) y safe_to_test: true. Si NO pasa, devuelve green=false con el motivo y NO commitees nada. Nunca commitees a medio work order.`,
    { label: `verify:${wo.id}`, phase: 'Verify', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
}

// build → review (hasta 2 ciclos) → verify. Freeze-on-red si verify queda rojo
// o si el review sigue rechazando tras 2 ciclos.
async function runWO(wo) {
  try {
    let attempt = 0
    while (true) {
      attempt++
      try {
        await build(wo)
        await review(wo)
        break
      } catch (e) {
        const msg = String((e && e.message) || e)
        if (attempt >= 2 || !msg.startsWith('REVIEW_REJECT')) throw e
        log(`↻ ${wo.id}: review rechazó (intento ${attempt}/2), reintenta`)
      }
    }
    const v = await verifyWO(wo)
    if (!v || !v.green) throw new Error('VERIFY_RED: ' + ((v && v.failure) || 'verify.sh en rojo'))
    log(`✓ ${wo.id} en verde${v.sha ? ' (' + v.sha.slice(0, 8) + ')' : ''}`)
    return v
  } catch (e) {
    log(`✗ ${wo.id} BLOQUEADO (${String((e && e.message) || e).slice(0, 100)}) — freeze-on-red`)
    await agent(`Freeze-on-red del work order ${wo.id}: NO commitees nada roto. Deja HEAD en last_green_sha, marca el work order ${wo.id} como BLOQUEADO en docs/estado.yaml con el motivo, y emite una notificación al dueño (hook PushNotification / Notification). No toques otros work orders.`,
      { label: `freeze:${wo.id}`, phase: 'Verify', model: P.worker, agentType: 'pandacorp:implementer' })
    return { green: false }
  }
}

// ── Olas por dependencias ─────────────────────────────────────────────────────
// Una ola = work orders cuyas deps ya están en verde. Dentro de la ola corren en
// paralelo (en pro, una a una). Barrera entre olas. Si una dep quedó BLOQUEADA,
// sus dependientes se omiten. Circuit breaker por presupuesto.
const pending = new Map(plan.workOrders.map((w) => [w.id, w]))
while (pending.size > 0) {
  const ready = []
  const dead = []
  for (const wo of pending.values()) {
    if (wo.deps.some((d) => blocked.has(d))) dead.push(wo)
    else if (wo.deps.every((d) => done.has(d) || !pending.has(d))) ready.push(wo)
  }
  for (const wo of dead) { blocked.add(wo.id); pending.delete(wo.id); log(`⊘ ${wo.id} omitido (depende de un bloqueado)`) }
  if (ready.length === 0) {
    if (pending.size > 0) log(`⚠ ${pending.size} work orders sin resolver (deps circulares o bloqueadas)`)
    break
  }
  if (budget.total && budget.remaining() < 60000) { log('Circuit breaker: presupuesto bajo, paro en punto seguro'); break }

  const wave = ready.slice(0, P.wave)
  const results = P.wave === 1
    ? [await runWO(wave[0])]
    : await parallel(wave.map((wo) => () => runWO(wo)))

  for (let i = 0; i < wave.length; i++) {
    pending.delete(wave[i].id)
    if (results[i] && results[i].green) { done.add(wave[i].id); built.push(wave[i].id) }
    else blocked.add(wave[i].id)
  }
}

// ── Cierre ────────────────────────────────────────────────────────────────────
phase('Verify')
if (built.length > 0 && blocked.size === 0) {
  await agent(`Todos los work orders cerraron en verde. Corre la suite completa + e2e de los flujos críticos y mata los dev servers de prueba con TaskStop. Si todo queda verde, marca docs/estado.yaml fase: release y running: false. Resume qué se construyó y la evidencia.`,
    { label: 'cierre', phase: 'Verify', model: P.judge, agentType: 'pandacorp:reviewer' })
} else if (blocked.size > 0) {
  log(`Construcción detenida con ${blocked.size} bloqueado(s): ${[...blocked].join(', ')}. Revisa docs/decisiones.md / docs/bugs/ y re-lanza implement.`)
}

return { mode: MODE, total: plan.workOrders.length, built, blocked: [...blocked] }

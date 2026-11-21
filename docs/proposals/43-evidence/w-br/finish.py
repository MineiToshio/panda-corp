from pathlib import Path
import re,subprocess
p=Path('branches.md'); s=p.read_text()
intro='''## Lectura rápida con evidencia

- CI: `bedacffb` corrige dependencias del runner limpio (Node/Codex reales, zsh, Chromium), fixtures Git locales sin firma, revocación sin carrera de timeout y oracle del Manual actualizado; no cambia la selección de specs del gate de producto. Está en main: `git merge-base --is-ancestor fix/engine-tests-ci main → exit 0`; log/diff/status completos debajo. Fuente adicional: `/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:9` (dependencias), `:25` (aislamiento), `:37` (oracle), `:45` (límites sandbox/Ubuntu).
- Variables del verify: `PANDACORP_VERIFY_OWNER_PID` es control interno de lock, no selector (:53–74); `PANDACORP_VERIFY_NO_BAIL` modifica bail de runners (:202, :670–672, :941); `PANDACORP_VITEST_SEED` reproduce orden (:419, :677, :941); `PANDACORP_CURATED_DATA_GLOBS` configura el guard de datos curados (:768). Rutas: `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh`. `PANDACORP_E2E_CERTIFICATION=1` habilita maxFailures de certificación, `PANDACORP_E2E_SERVER=prod` el servidor de producción y `PANDACORP_E2E_TIER=combined` la división por inventarios (:671, :989–994). No-bail no activa por sí solo report-all: los estáticos siguen abortando al primer fallo salvo --report-all (:743, :915); combinar ambos para diagnóstico amplio.
- Configuración Playwright común en los tres `<proyecto>/playwright.config.ts`: workers por defecto 1; tier parallel/combined usa `PANDACORP_E2E_WORKERS` o 3 (:103); combined diagnóstico 1; seriales desktop/mobile override 1 (:165, :186, :199). Retries 0, fullyParallel false y maxFailures 1 solo certificación sin diagnóstico, 0 en resto (:164–168). Browser Desktop Chrome en desktop y mobile por viewport, más desktop-parallel/mobile-parallel en combined (:145–157, :181–201). No se configura Firefox/WebKit. Servidor: GATE_PROD usa prod-server start, PROD_SMOKE build+start y resto next dev (:204–208); verify full construye primero prod-server si existe, --since queda dev (verify :987–996). Las tres fuentes y sus prod-server están transcritas abajo con líneas.
- Vitest: Mission Control Node + DOM según inventario revisado, sin pool ni cap explícito en config (:7–38); helper aislado y override `PANDACORP_VITEST_MAX_WORKERS` validado (`mission-control/.pandacorp/vitest-policy.ts:16–24`, :50–75). PersonalPage mantiene una sola raíz jsdom, con maxWorkers heredado del helper y sin cap/pool explícitos (`personal-page-v2/vitest.config.ts:39–58`). Funko usa Node revisado/annotation y resto jsdom, maxWorkers `min(5,max(1,availableParallelism()-2))`, override del helper; sin pool explícito (`funko-tracker/vitest.config.mts:9–23`, :50–55). Ausencia de pool/cap significa delegación al runner, no workers=1. Fuentes completas debajo.

| Proyecto (raíz /Users/Shared/Proyectos/) | Specs e2e, medida collect.py | tests e2e estimados por suma rg -c test\\( | Archivos Vitest candidatos, medida collect.py |
|---|---:|---:|---:|
| panda-corp/mission-control | 72 | 295 | 540 |
| funko-tracker | 72 | 254 | 888 |
| personal-page-v2 | 18 | 59 | 180 |

Los inventarios y salidas de conteo están en §4. El conteo unitario excluye archivos de worktrees/runtime y caches; no ejecuta discovery del runner y puede incluir candidatos excluidos por config (por ejemplo docs de Funko). Por ello no es una cifra de tests ejecutados. Las cifras e2e cuentan líneas que contienen `test(`, incluidos helpers; no cuentan expansiones de loops, test.each ni nombres con otras sintaxis.

'''
s=s.replace('## 1. Ramas y aterrizajes',intro+'## 1. Ramas y aterrizajes',1)
# Add exact CI documentation and provenance per count.
for path in [Path('/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md'),Path('/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0302-diff-selected-browser-inner-check.md')]:
 if path.exists(): s+='\n### '+str(path)+'\n'+ '\n'.join(f'{path}:{n}: {l}' for n,l in enumerate(path.read_text().splitlines(),1))+'\n'
p.write_text(s)
# Read required context without dumping unrelated registry/policy into report.
for name in ['AGENTS.md','factory/constitution.md','factory/standards/agent-portability.md','factory/decisions/registry.yaml']:
 text=(Path('/Users/Shared/Proyectos/panda-corp')/name).read_text(); print('Contexto leído:',name,len(text.splitlines()),'líneas')

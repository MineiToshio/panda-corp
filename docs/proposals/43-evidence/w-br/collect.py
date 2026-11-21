from pathlib import Path
import subprocess,re,datetime,os
R=Path('/Users/Shared/Proyectos/panda-corp'); out=[]
def add(s): out.append(s)
def cmd(args):
 p=subprocess.run(args,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT); add('```text\n$ '+' '.join(args)+'\n'+(p.stdout or '(sin salida)\n')+f'[exit {p.returncode}]\n```'); return p.stdout
def lines(p,pattern=None):
 p=Path(p); add('\n### '+str(p))
 if not p.exists(): add('No existe este artefacto.'); return
 for n,l in enumerate(p.read_text().splitlines(),1):
  if pattern is None or re.search(pattern,l,re.I): add(f'{p}:{n}: {l}')
add('# Trabajo existente sobre gate y cola\n\nInspección de solo lectura, 2026-11-20. Las salidas git y conteos son **medidas** del checkout observado; no se ejecutaron gates, tests, builds ni servidores. Los conteos `test\\(` son **estimados** de declaraciones, no casos expandidos ni ejecuciones. Las rutas absolutas con línea constituyen las citas.\n')
add('## 1. Ramas y aterrizajes\n\n`feat/verify-affected-browser-gates` conserva tres commits no ancestros de main, pero su comportamiento ya existe en el verify actual: no selecciona specs individualmente por impacto; omite TODO Playwright únicamente para cambios probados de queries/worker. Si hay UI, dependencias o incertidumbre Git conserva navegador completo. Siempre partial, nunca certificación. Por ello no debe confundirse rama no mergeada topológicamente con funcionalidad pendiente. `fix/engine-tests-ci` está totalmente contenida en main y no tiene diff contra su merge-base; no es una rama en curso en sentido topológico. La existencia de commits/tests no demuestra que estén verdes hoy. Evidencia abajo y sección 2.')
for b,w in [('feat/verify-affected-browser-gates','panda-corp-wt-verify-affected'),('fix/engine-tests-ci','panda-corp-wt-ci')]:
 add('### '+b)
 for a in [['log','--date=iso','main..'+b],['diff','--stat','main...'+b],['log','-1','--date=iso','--format=%H %ad %s',b],['merge-base','--is-ancestor',b,'main']]: cmd(['git','-C',str(R)]+a)
 cmd(['git','-C',str(R.parent/w),'status','--porcelain'])
cmd(['git','-C',str(R),'show','--stat','bedacffb'])
cmd(['git','-C',str(R),'show','bedacffb','--','.github/workflows'])
cmd(['git','-C',str(R),'log','-5','--date=iso','--format=%h %ad %s','main','--','plugin/templates/stack-a-nextjs/verify.sh'])
add('### Otras ramas no mergeadas: ventana inclusiva 2026-10-30–2026-11-20\nCriterio: fecha de tip >= 2026-10-30; nombre relevante o diff main...rama toca los paths pedidos. Se inspeccionan nombres locales, no remotos.')
bs=cmd(['git','-C',str(R),'branch','--no-merged','main','--sort=-committerdate'])
refs=subprocess.check_output(['git','-C',str(R),'for-each-ref','--format=%(refname:short)|%(committerdate:iso8601)','refs/heads'],text=True)
found=[]
for row in refs.splitlines():
 b,d=row.split('|',1)
 if b not in [x.strip().lstrip('+* ') for x in bs.splitlines()] or d[:10]<'2026-10-30' or b=='feat/verify-affected-browser-gates': continue
 diff=subprocess.check_output(['git','-C',str(R),'diff','--name-only','main...'+b],text=True)
 hits=[x for x in diff.splitlines() if re.search(r'(^|/)(verify|merge-queue|green-stamp)\.sh$|^plugin/runtime/build/',x)]
 if hits or re.search('verify|merge.queue|green.stamp|runtime.build',b):
  found.append(b); add(f'**{b}** — tip {d}; paths relevantes: '+', '.join(hits)); cmd(['git','-C',str(R),'log','-1','--date=iso','--format=%H %ad %s',b]); cmd(['git','-C',str(R),'diff','--stat','main...'+b])
add('Coincidencias adicionales (**medida** por algoritmo collect.py): '+str(len(found)))
add('## 2. Modos ya instalados\n\nSin flags: estáticos completos + Vitest completo + navegador completo; scope full, sello solo verde y árbol limpio e inalterado. --light: todos los estáticos, sin navegador ni Vitest salvo --tests; partial. --since SHA en primera posición: estáticos globales, Vitest --changed SHA, Playwright smoke+shell; since. --only: solo subgates nombrados; partial. --files: Biome sobre paths y Vitest related; demás gates globales incluido navegador; partial. --tests: prioridad sobre --files/--since para Vitest run de archivos explícitos; partial, navegador conserva selección general. --affected: estáticos y Vitest completos, omisión binaria de navegador solo data-only; partial aun si mantiene todo. --no-bail: no reduce selección ni scope, acumula fallos, quita bail/maxFailures; puede certificar full. --report-all acumula estáticos, no equivale por sí solo a no-bail. --canary delega y no genera reporte propio. --light y --only son excluyentes. Los scopes parciales/since nunca escriben sello; cualquier rojo invalida. Las citas siguientes incluyen implementación y plantilla, no solo comentarios.')
for p in [R/'mission-control/.pandacorp/verify.sh',R/'plugin/templates/stack-a-nextjs/verify.sh']:
 lines(p) 
add('## 3. DR-158 / DR-159 y backlog\n\nDR-158 conserva G3 completo; fail-fast, dueño único del checkout, sello v2 con entorno/dependencias/fixtures, servidor prod compartido, inventarios móviles y paralelismo revisado, --affected solo iteración. Cifras **citadas por registro, no medidas aquí**: bail/maxFailures=1; contención exit 75; tier seguro 3 workers y diagnóstico 1 worker. No certifica partial; no hashea ediciones arbitrarias internas de node_modules; timings requieren medidas browser sin restricciones. DR-159 hace durable el coste: warnings por specs no clasificadas, conserva serial/ambas plataformas ante ausencia; helper Vitest Node/DOM con override validado y sin sobrescribir config del proyecto; presupuestos avisan sin fallar ni omitir ni autocambiar baseline. Reuso de fixtures queda solo documentado. Versiones **citadas**, no benchmark: plugin 10.2.0/overlay 9.2.0.')
p=R/'factory/decisions/registry.yaml'
for n,l in enumerate(p.read_text().splitlines(),1):
 if 934<=n<=944: add(f'{p}:{n}: {l}')
add('### Ítems abiertos relacionados (búsqueda amplia en texto completo; incluye operación adyacente)')
for p in sorted((R/'factory/backlog').glob('*.md')):
 t=p.read_text(); m=re.search(r'^status:\s*(open|doing)\s*$',t,re.M)
 if m and re.search(r'verify|merge.queue|green.stamp|flak|slow|speed|latenc|gate.*cost|cost.*gate|gate.*time|test.*unstable|sello',t,re.I):
  lines(p,r'^id:|^title:|^status:|verify|merge.queue|green.stamp|flak|speed|latenc|gate.*cost')
add('## 4. Playwright y Vitest por proyecto\n\nPlaywright tiene variantes por entorno/tier: no confundir workers globales con override serial por proyecto, ni declaraciones con casos multiplicados por viewport. Las fuentes completas siguientes permiten auditar los defaults y ramas. El conteo Vitest usa archivos *.test/ *.spec TS/JS fuera de e2e, node_modules, .next y .git; se informa además include/exclude real para contrastar el alcance.')
lines(R/'factory/portfolio.md',r'^\| (PersonalPage|Funko)')
for p in [R/'mission-control',R.parent/'funko-tracker',R.parent/'personal-page-v2']:
 add('### '+str(p))
 for name in ['playwright.config.ts','vitest.config.ts','vitest.config.mts','.pandacorp/vitest-policy.ts','e2e/prod-server.mjs']:
  lines(p/name)
 cmd(['rg','-c',r'test\(',str(p/'e2e')])
 specs=list((p/'e2e').rglob('*.spec.*')); add(f'**medida** collect.py: {len(specs)} archivos e2e *.spec.* en {p}/e2e.')
 files=[]
 for base,dirs,names in os.walk(p):
  dirs[:]=[x for x in dirs if x not in ['node_modules','.next','.git','.next-fidelity','.claude','.pandacorp','.stryker-tmp','.mutation-cache']]
  for name in names:
   f=Path(base)/name
   if re.search(r'\.(test|spec)\.[cm]?[jt]sx?$',f.name) and 'e2e' not in f.relative_to(p).parts: files.append(f)
 add(f'**medida** collect.py: {len(files)} archivos unit/component candidatos; inventario:')
 add('\n'.join(str(f) for f in files))
 t=subprocess.run(['rg','-c',r'test\(',str(p/'e2e')],text=True,stdout=subprocess.PIPE).stdout
 total=sum(int(x.rsplit(':',1)[1]) for x in t.splitlines()); add(f'**estimada** suma rg -c test\\(: {total} líneas coincidentes (bucles/parametrización/test.skip/multilínea pueden diferir).')
Path('branches.md').write_text('\n\n'.join(out)+'\n')

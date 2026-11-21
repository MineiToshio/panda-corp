from pathlib import Path
import re,subprocess
s=Path('branches.md').read_text(); checks=[]
checks.append(('cuatro secciones',all('## '+str(n)+'.' in s for n in range(1,5))))
checks.append(('comandos git solicitados',all(x in s for x in ['log --date=iso main..feat/verify-affected-browser-gates','diff --stat main...fix/engine-tests-ci','status --porcelain','branch --no-merged main --sort=-committerdate'])))
checks.append(('flags y decisiones',all(x in s for x in ['--light','--since','--only','--files','--tests','--no-bail','--affected','DR-158','DR-159'])))
refs=re.findall(r'^(/Users/Shared/Proyectos/[^\n:]+):(\d+):',s,re.M)
bad=[]
cache={}
for p,n in refs:
 if p not in cache: cache[p]=Path(p).read_text().splitlines() if Path(p).is_file() else []
 if int(n)>len(cache[p]): bad.append((p,n))
checks.append(('citas archivo:línea existentes',len(refs)>2000 and not bad))
checks.append(('tres proyectos y conteos',s.count('**estimada** suma rg')==3 and s.count('archivos unit/component candidatos')==3))
checks.append(('síntesis y límites',all(x in s for x in ['Lectura rápida','No-bail no activa','No existe este artefacto','no se ejecutaron gates'])))
for label,ok in checks: print(label,'→','PASS' if ok else 'FAIL')
print('Citas verificadas:',len(refs)); print('Informe bytes:',Path('branches.md').stat().st_size)
assert all(ok for _,ok in checks)

import pathlib,json,datetime
p=pathlib.Path('timeline-ext.md');s=p.read_text();data=json.load(open('evidence.json'))
intro='''Lectura principal: Funko conserva 31 reportes y dos corridas de cola identificables; PersonalPage conserva un reporte y ninguna corrida identificable en los run inspeccionados (**medida**, tablas y evidence.json). Los full verdes recientes de Funko suman 23,465–24,992 min de etapas; PersonalPage suma 3,834 min (**medida**, tablas de sumas). No se demuestra que todos los merges tarden 30–60 minutos: faltan trazas completas de esas esperas.

'''
s=s.replace('## funko-tracker',intro+'## funko-tracker',1)
s=s.replace('### 6. Huecos','### 6. Huecos',1)
s+='''\n## Complemento: archivos temporales y semáforo de host

**medida**, lectura posterior al snapshot inicial: `/Users/sergio/.pandacorp/host/h-slots/slot-0/owner.json:1` contiene pid 35294, kind merge-queue, project `/Users/Shared/Proyectos/funko-tracker/.claude/worktrees/nifty-haibt-c4dee1`, at `2026-11-20T23:33:17Z`. Es una lease presente, no prueba de PID vivo: ps está bloqueado. El estado puede cambiar durante esta investigación.

verify.sh escribe fragmentos y logs en un `mktemp -d` sin nombre estable y los elimina al salir (ambos proyectos, `.pandacorp/verify.sh:425–428,547,568`). Reemplaza gate-report.json al comenzar (:128–130). green-stamp usa `.pandacorp/run/green-stamp` (`green-stamp.sh:22`), registra únicamente full verde y limpia certificado al rojo (verify.sh:624–628). Por ello los reportes latest no son un historial. Se buscó también en directorios tmp.* de `/private/tmp` y `$TMPDIR=/var/folders/mq/_dzhfn4j2hq82rm43zgnkykw0000gn/T/`; inventario medido guardado en `temp-fragments.json` (ruta, tamaño, mtime).

Se halló un directorio temporal activo aparente, sin proyecto/argv/at en su esquema. Su asociación a Funko es **estimada** por simultaneidad con lease host; no se mezcla con estadísticas históricas ni se afirma full/verde final. Lo completado es verde hasta Vitest; Playwright tiene log pero todavía no fragmento en el snapshot. Total parcial excluye Playwright y etapas futuras, no es total de corrida.

Etapa | ms medidos | Fuente
--- | --- | ---
'''
rows=json.load(open('temp-fragments.json'));total=0
for r in rows:
 if r['sample']:
  for i,line in enumerate(r['sample'].splitlines(),1):
   d=json.loads(line);total+=d['duration_ms'];s+=f"{d['name']} | {d['duration_ms']} | {r['path']}:{i} @ mtime {r['mtime']}\n"
s+=f'\nSuma parcial **medida**: {total} ms; fuente: fragmentos anteriores; sin duración total reportada. Inventario de todos los temporales hallados:\n\nRuta | Bytes | mtime (fuente stat)\n--- | --- | ---\n'
for r in rows:s+=f"{r['path']} | {r['bytes']} | {r['mtime']}\n"
s+='''
## Secuencias cerca de una declaración de terminado

En Funko, `0b33ae6a` declara WO-01-017/018 verified con revisión y e2e verde el 2026-11-14 02:41:02 -0500 (`funko-tracker-git-log.txt:151`). Siguen `16452d12` 02:58:02 (alinear spec), `8ad0883a` 03:21:57 (independizar e2e de muestra aleatoria), `72797cbb` 03:52:32 (fix native result), `ef4a27a9` 04:07:41 (fixtures y parity), `f2a9ea15` 04:41:10 y `394056ed` 05:04:25 (fix POST). Fuentes medidas: `funko-tracker-git-log.txt:145–150`; tabla de commits conserva hash completo. Señal de trabajo posterior a “verified”, **no prueba** de seis gates rojos: faltan reportes ligados a cada commit. Los mensajes baseline hallados tratan datos de ingestión, no se clasifican automáticamente como reparación del gate. No se halló mensaje flaky/snapshot que pruebe una vuelta tras verified en PersonalPage en esta ventana; los cambios gate son upgrades del overlay (`personal-page-v2-git-log.txt:2–3`).

Las estadísticas por etapa mezclan scopes y fechas según cada fila; son descriptivas de los artefactos conservados, no comparaciones controladas ni percentiles de todas las ejecuciones. Copias históricas pueden duplicar una misma corrida.
'''
p.write_text(s)

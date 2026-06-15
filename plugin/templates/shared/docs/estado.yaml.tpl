# Estado del proyecto {{PROJECT_NAME}} — leído por la fábrica Pandacorp y por Mission Control (en vivo)
proyecto: "{{PROJECT_NAME}}"
fase: producto   # producto | diseno | arquitectura | implementacion | release | operacion
version: v1
running: false    # true mientras /pandacorp:implement está construyendo activamente
repo: ""          # URL del repo GitHub cuando exista
actualizado: "{{DATE}}"
progreso: "Proyecto recién creado por scaffold; fase de producto pendiente."
work_orders_total: 0
work_orders_done: 0
decisiones_pendientes: 0   # nº de entradas pendientes en docs/decisiones.md (Mission Control las resalta)
bugs_pendientes: 0         # nº de bugs en la bandeja docs/bugs/ por procesar
replanteo_pendiente: false # true si /iterate pidió pausar la construcción por un cambio fuerte
avance_pendiente: false    # true cuando la fase actual produjo output y espera tu "ok, avanza" (mientras, re-correr la fase = iterar en sitio, DR-032)
last_green_sha: ""         # commit del último work order cerrado en verde (lo escribe el gate, no el agente)
safe_to_test: false        # true solo cuando HEAD == last_green_sha (nada sin commitear) → "punto probable"
pendientes: []

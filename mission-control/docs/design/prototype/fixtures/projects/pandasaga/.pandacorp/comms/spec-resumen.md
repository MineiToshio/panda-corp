---
proyecto: "PandaSaga"
fase: "producto"
---

> Retoma cualquier historia donde la dejaste: un resumen hasta tu capítulo, una enciclopedia que solo muestra lo que ya viste y un mapa de quién es quién, sin un solo spoiler.

## 📋 PRD

### El problema
- **Volver cuesta** — tras semanas sin leer, nadie recuerda quién era quién.
- **Buscar es arriesgado** — cualquier búsqueda en internet trae spoilers del final.
- **Varias versiones** — la misma historia existe en libro, serie y videojuego, con ritmos distintos.
- **Las wikis no esperan** — están escritas para quien ya terminó.

### Hipótesis de valor
Si un lector puede retomar una historia en menos de dos minutos sin toparse con nada que no haya visto, volverá a la app cada vez que retome una saga.

### Usuarios
- **Lector intermitente** — lee por temporadas y necesita recordar antes de seguir.
- **Fan multiformato** — sigue la misma historia en libro y en serie.
- **Curador de contenido** — prepara el catálogo de cada obra con la herramienta de ingesta.

### Métricas de éxito
- **Retomas exitosas** — 70 % de las sesiones que abren un resumen siguen leyendo.
- **Cero spoilers reportados** — menos de 1 reporte por cada 1 000 lecturas de la enciclopedia.
- **Cuentas** — 30 % de los invitados crea cuenta en su segunda visita.
- **Obras activas** — 5 obras completas en el catálogo al lanzar.
- **Tiempo hasta retomar** — mediana menor a 2 minutos.
- **Retención mensual** — 40 % de los lectores vuelve al mes siguiente.

### Alcance v1
- Lectura como invitado
- Cuenta con enlace mágico
- Progreso por capítulo
- Resumen antes de retomar
- Enciclopedia limitada por progreso
- Mapa de conexiones
- Explorador de capítulos
- Catálogo publicado de forma atómica
- Reporte de spoilers
- Herramienta de ingesta para el curador
- Modo oscuro
- Exportar mi progreso
- Borrar mi cuenta
- Cinco obras iniciales
- Imágenes con crédito
- Búsqueda en la enciclopedia
- Marcadores

### Fuera del v1
- Comentarios y comunidad
- Recomendaciones personalizadas
- App nativa
- Audiolibros
- Traducciones automáticas
- Monetización
- Contenido generado por lectores

### Decisiones abiertas
- **Obras iniciales** — ¿qué cinco obras entran al lanzamiento?
- **Ritmo de publicación** — ¿una obra nueva por mes o por temporada?
- **Imágenes** — ¿ilustraciones propias o arte oficial con licencia?
- **Invitados** — ¿cuánto tiempo se guarda el progreso de un invitado?
- **Reportes** — ¿quién revisa un spoiler reportado y en cuánto tiempo?

## 🔬 Research

### Hallazgo clave
Los lectores no buscan "todo sobre la obra": buscan "lo que yo ya sé", y ninguna herramienta actual sabe hasta dónde llegaste.

### El diferenciador
Cada dato del catálogo está atado al capítulo donde aparece; la app solo muestra lo que el lector ya pasó, en cualquier formato de la obra.

### Referentes
- **Wikis de fans** — completas, pero llenas de spoilers.
- **Resúmenes en video** — útiles, pero cubren temporadas enteras.
- **Apps de seguimiento de lectura** — registran el avance, no explican la historia.
- **Guías de personajes impresas** — las mejores, pero solo para libros concretos.
- **Foros de relectura** — muestran la demanda de "recordar sin spoilers".
- **Asistentes de IA genéricos** — responden, pero sin saber dónde vas.
- **Sitios de sinopsis por capítulo** — granularidad correcta, diseño hostil.
- **Bases de datos de series** — buenas fichas, sin límite de progreso.
- **Clubes de lectura** — confirman el hábito de leer por temporadas.

## 🧩 FRDs

### FRD-01 · Cuenta y progreso de lectura · UI
Leer como invitado y guardar el progreso por capítulo.
**Resumen:** el progreso es la base de todo: sin saber dónde vas, la app no puede protegerte de spoilers. Se puede empezar sin cuenta y crearla después sin perder nada.
**Historias de usuario:**
- Como lector quiero marcar el capítulo donde quedé con un toque.
- Como invitado quiero crear una cuenta sin perder lo que ya marqué.
- Como fan multiformato quiero llevar el progreso del libro y de la serie por separado.
- Como lector quiero borrar mi cuenta y todo mi progreso.
**Reglas de negocio:**
- El progreso nunca retrocede salvo que el lector lo pida.
- Un invitado conserva su progreso en el dispositivo durante 90 días.
- Fusionar un invitado con una cuenta conserva el capítulo más avanzado.
- Borrar la cuenta elimina el progreso en menos de 24 horas.
- Cada obra lleva su progreso por versión (libro, serie, juego).
- Marcar un capítulo es reversible durante 10 segundos.
- El estado de sesión se guarda en una cookie segura.
- No se piden datos personales más allá del correo.
- Exportar mi progreso entrega un archivo legible.
- Una cuenta nueva empieza sin obras en la estantería.
- La estantería muestra primero la obra retomada más recientemente.
- La sincronización entre dispositivos ocurre al abrir la app.
- Los errores de red no pierden la última marca.
- Los invitados no pueden reportar spoilers.
- Las cuentas inactivas por un año reciben un aviso antes de borrarse.
**Fuera de alcance:**
- Inicio con redes sociales.
- Perfiles públicos.
**Preguntas abiertas:**
- ¿El progreso de invitado se puede pasar a otro dispositivo con un código?

### FRD-02 · Catálogo sin spoilers · Infra
El formato y la publicación del catálogo de cada obra, con cada dato atado a su capítulo.
**Resumen:** el catálogo se publica como un paquete versionado y atómico; nada se muestra si su capítulo es posterior al del lector.
**Historias de usuario:**
- Como curador quiero publicar una obra entera de una vez, sin estados a medias.
- Como lector quiero reportar un spoiler con un toque.
**Reglas de negocio:**
- Un paquete se publica completo o no se publica.
- Todo dato sin capítulo de aparición se rechaza en la publicación.
- La visibilidad se calcula en el servidor, nunca en el navegador.
- Un reporte de spoiler oculta el dato hasta su revisión.
- Las versiones anteriores del paquete se conservan 30 días.
- El catálogo se sirve con caché por obra y capítulo.
- Las imágenes llevan su crédito en el mismo paquete.
- Una obra puede tener varias versiones con capítulos distintos.
- El paquete se valida contra su esquema antes de publicarse.
- La publicación deja un registro de auditoría.
- El curador puede retirar una obra sin borrar el progreso de los lectores.
**Fuera de alcance:**
- Edición del catálogo desde la web.
- Contenido aportado por lectores.
- Publicación programada.
**Preguntas abiertas:**
- ¿Cuánto tarda en propagarse una corrección del catálogo?

### FRD-03 · Resumen antes de retomar · UI
Un resumen breve de lo ocurrido hasta el capítulo del lector.
**Resumen:** la pantalla que justifica la app: en dos minutos sabes dónde estabas.
**Historias de usuario:**
- Como lector intermitente quiero un resumen hasta mi capítulo antes de seguir.
- Como lector quiero saltar a los personajes que reaparecen en el siguiente capítulo.
- Como lector quiero elegir un resumen corto o largo.
- Como fan multiformato quiero el resumen de la versión que estoy siguiendo.
**Reglas de negocio:**
- El resumen nunca incluye nada posterior al capítulo del lector.
- Cada sección del resumen enlaza a su entrada de la enciclopedia.
- El resumen corto cabe en una pantalla de teléfono.
- Los resúmenes se generan al publicar el paquete, no al pedirlos.
- Si no hay resumen para ese capítulo, se ofrece el anterior más cercano.
- El resumen indica a qué capítulo corresponde.
- Las imágenes del resumen llevan su crédito.
**Fuera de alcance:**
- Resúmenes en audio.
**Preguntas abiertas:**
- ¿Cuántas secciones como máximo tiene un resumen largo?

### FRD-04 · Enciclopedia de la historia · UI
Fichas de personajes, lugares y facciones que solo dicen lo que el lector ya vio.
**Resumen:** cada ficha tiene revisiones por capítulo; el lector ve la última revisión que le corresponde.
**Historias de usuario:**
- Como lector quiero consultar quién es un personaje sin enterarme de su destino.
- Como lector quiero buscar dentro de la enciclopedia.
- Como lector quiero guardar fichas para volver a ellas.
**Reglas de negocio:**
- Una ficha muestra solo la revisión visible para el capítulo del lector.
- La búsqueda no sugiere fichas que el lector todavía no conoce.
- Los marcadores sobreviven a los cambios de revisión.
- Una ficha indica "hay más después de tu capítulo" sin decir qué.
- Las fichas de una obra no aparecen en otra.
- El índice se ordena por primera aparición.
- Las fichas sin revisión visible no existen para el lector.
- Las imágenes de una ficha también respetan el capítulo.
- Los enlaces entre fichas se ocultan si el destino no es visible.
**Fuera de alcance:**
- Edición colaborativa de fichas.
**Preguntas abiertas:**
- ¿Mostramos el número de capítulo de cada revisión?

### FRD-05 · Mapa de conexiones · UI
Un mapa interactivo de quién se relaciona con quién, hasta el capítulo del lector.
**Resumen:** la vista que más piden los fans: las relaciones aparecen a medida que se revelan.
**Historias de usuario:**
- Como lector quiero ver las relaciones de un personaje en un mapa.
- Como lector quiero filtrar el mapa por tipo de relación.
**Reglas de negocio:**
- Una conexión aparece solo desde el capítulo que la revela.
- El mapa funciona también como lista en el teléfono.
- Cada conexión lleva su tipo como texto, no solo como color.
- El mapa se puede recorrer con teclado.
- Las conexiones ocultas no dejan huecos que delaten su existencia.
- El mapa se centra en el personaje elegido.
**Fuera de alcance:**
- Exportar el mapa como imagen.
**Preguntas abiertas:**
- ¿Cuántos nodos se muestran antes de agrupar?

### FRD-06 · Explorar capítulos · UI
La lista de capítulos de cada versión y qué cambia en cada uno.
**Resumen:** sirve para ubicarse y para marcar el progreso exacto.
**Historias de usuario:**
- Como lector quiero ver la lista de capítulos y marcar dónde voy.
- Como lector quiero ver qué personajes aparecen por primera vez en un capítulo ya leído.
- Como fan multiformato quiero cambiar de versión sin perder mi lugar.
**Reglas de negocio:**
- Los capítulos no leídos solo muestran su número y título.
- Cambiar de versión conserva el progreso de cada una.
- El capítulo actual siempre está a la vista al abrir la lista.
- Los títulos de capítulos con spoiler se ocultan hasta leerlos.
- La lista carga por partes en obras con muchos capítulos.
**Fuera de alcance:**
- Lectura del texto completo dentro de la app.
- Notas personales por capítulo.
**Preguntas abiertas:**
- ¿Hace falta una vista por temporada en las series?

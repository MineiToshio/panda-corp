---
proyecto: "PandaCast"
fase: "producto"
---

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
- ¿Qué pasa si la red de origen borra el video?

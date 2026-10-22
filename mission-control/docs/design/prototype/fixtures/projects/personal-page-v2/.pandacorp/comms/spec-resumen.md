---
proyecto: "PersonalPage v2"
fase: "producto"
---

> Un portafolio personal que en diez segundos deja claro qué construye este desarrollador, para quién y con qué resultados.

## 📋 PRD

### El problema
- **El portafolio viejo no dice nada** — una lista de tecnologías sin contexto.
- **Los casos no se cuentan** — no hay forma de mostrar el problema, la decisión y el resultado.
- **Un solo idioma** — la mitad de los contactos llega en otro idioma.
- **El blog está abandonado** — escribir cuesta y se posterga.

### Hipótesis de valor
Si cada proyecto se cuenta como un caso con resultado medible, los contactos llegan ya sabiendo qué pedir.

### Usuarios
- **Responsable de contratación** — revisa en dos minutos si el perfil encaja.
- **Cliente potencial** — busca alguien que ya resolvió un problema parecido.
- **El propio autor** — quiere publicar sin fricción.

### Métricas de éxito
- **Contactos calificados** — 4 por mes.
- **Tiempo en casos** — más de 90 segundos por visita a un caso.
- **Publicaciones** — 2 entradas por mes.
- **Rendimiento** — Lighthouse por encima de 95 en el teléfono.
- **Idiomas** — 100 % de las páginas en los dos idiomas.

### Alcance v1
- Estructura con dos idiomas
- Temas claro y oscuro
- Inicio con propuesta clara
- Índice de proyectos
- Casos de estudio
- Sobre mí y ahora
- Blog en MDX
- SEO y datos estructurados
- Formulario de contacto
- Skill para escribir el blog

### Fuera del v1
- Comentarios
- Boletín por correo
- Tienda
- Panel de administración
- Analítica propia
- Búsqueda en el sitio
- Modo sin conexión
- Traducción automática

### Decisiones abiertas
- **Dominio** — ¿se mantiene el dominio actual?
- **Fotos** — ¿retrato profesional o ilustración?
- **Tono** — ¿primera persona en los casos?
- **Formulario** — ¿servicio alojado o función propia?
- **Blog** — ¿cuántas entradas antes de lanzar?

## 🔬 Research

### Hallazgo clave
Los responsables de contratación leen el primer párrafo de un caso y saltan al resultado; si no hay número, siguen de largo.

### El diferenciador
Cada caso responde tres preguntas en orden: qué estaba roto, qué se decidió y qué cambió.

### Referentes
- **Portafolios de estudios pequeños** — casos cortos con un resultado destacado.
- **Blogs de ingeniería** — buena estructura, demasiado largos para un portafolio.
- **Perfiles profesionales** — alcance amplio, cero profundidad.
- **Sitios de una sola página** — rápidos, sin espacio para casos.
- **Plantillas populares** — bonitas e intercambiables.

## 🧩 FRDs

### FRD-01 · Estructura, idiomas y temas · UI
La base del sitio en dos idiomas, con temas sin parpadeo.
**Resumen:** todo el sitio comparte una estructura accesible y rápida.
**Historias de usuario:**
- Como visitante quiero cambiar de idioma sin perder la página.
- Como visitante quiero que el tema oscuro no parpadee al cargar.
- Como visitante con teclado quiero saltar al contenido.
**Reglas de negocio:**
- Cada página existe en los dos idiomas.
- El tema respeta la preferencia del sistema.
- El enlace para saltar al contenido es lo primero enfocable.
**Fuera de alcance:**
- Más de dos idiomas.
- Temas personalizados.
**Preguntas abiertas:**
- ¿La URL lleva el idioma como prefijo?

### FRD-02 · Inicio y posicionamiento · UI
La primera pantalla que explica qué hace el autor.
**Resumen:** una frase, tres pruebas y un llamado a la acción.
**Historias de usuario:**
- Como responsable de contratación quiero entender el perfil en diez segundos.
- Como cliente quiero ver resultados antes de seguir leyendo.
- Como visitante quiero llegar al contacto en un clic.
**Reglas de negocio:**
- La propuesta cabe en una línea en el teléfono.
- Las pruebas enlazan a sus casos.
- El inicio carga en menos de un segundo.
**Fuera de alcance:**
- Animaciones de entrada.
- Testimonios en video.
**Preguntas abiertas:**
- ¿Cuántas pruebas se muestran?

### FRD-03 · Proyectos y casos · UI
Índice de proyectos y casos contados en tres actos.
**Resumen:** el corazón del portafolio: problema, decisión y resultado.
**Historias de usuario:**
- Como cliente quiero filtrar proyectos por tipo de problema.
- Como responsable de contratación quiero leer el resultado primero.
- Como visitante quiero ver imágenes del proyecto en grande.
**Reglas de negocio:**
- Cada caso declara un resultado medible.
- Las imágenes llevan texto alternativo.
- Los casos se escriben en archivos de contenido.
**Fuera de alcance:**
- Casos privados con contraseña.
- Descarga en PDF.
**Preguntas abiertas:**
- ¿Hace falta un filtro por tecnología?

### FRD-04 · Sobre mí y ahora · UI
Quién es el autor y en qué está trabajando este mes.
**Resumen:** dos páginas cortas que humanizan el portafolio.
**Historias de usuario:**
- Como visitante quiero saber en qué trabaja el autor ahora.
- Como cliente quiero saber si tiene disponibilidad.
- Como responsable de contratación quiero un resumen de su trayectoria.
**Reglas de negocio:**
- La página "ahora" muestra su fecha de actualización.
- La disponibilidad se indica en texto, no solo con color.
- La trayectoria cabe en una pantalla.
**Fuera de alcance:**
- Currículum descargable.
- Línea de tiempo interactiva.
**Preguntas abiertas:**
- ¿Cada cuánto se actualiza "ahora"?

### FRD-05 · Blog en MDX · UI
Entradas en MDX con etiquetas y feed.
**Resumen:** escribir una entrada es crear un archivo; el sitio hace el resto.
**Historias de usuario:**
- Como lector quiero ver el tiempo de lectura.
- Como lector quiero suscribirme por RSS.
- Como autor quiero publicar con un archivo nuevo.
**Reglas de negocio:**
- Cada entrada declara idioma, fecha y etiquetas.
- El feed incluye las últimas 20 entradas.
- Una entrada sin traducción muestra un aviso.
- Las imágenes de portada llevan texto alternativo.
**Fuera de alcance:**
- Comentarios.
- Búsqueda en el blog.
**Preguntas abiertas:**
- ¿Las etiquetas se traducen?

### FRD-06 · SEO y datos estructurados · Infra
Metadatos, imágenes para redes y datos estructurados.
**Resumen:** que cada página se vea bien al compartirla y en los buscadores.
**Historias de usuario:**
- Como autor quiero que cada entrada tenga su imagen para redes.
- Como visitante quiero una vista previa clara al pegar un enlace.
- Como autor quiero que los buscadores entiendan mis artículos.
**Reglas de negocio:**
- Cada página declara su URL canónica.
- Las imágenes para redes se generan al construir el sitio.
- Los datos estructurados se validan en la integración continua.
- Las páginas en los dos idiomas se enlazan entre sí.
**Fuera de alcance:**
- Mapas del sitio por idioma separados.
- Herramientas de posicionamiento de pago.
**Preguntas abiertas:**
- ¿Qué tipos de datos estructurados entran en el v1?

### FRD-07 · Contacto · UI
Un formulario simple con un servicio alojado.
**Resumen:** escribir al autor sin exponer su correo.
**Historias de usuario:**
- Como cliente quiero escribir sin abrir mi correo.
- Como visitante quiero saber cuándo recibiré respuesta.
- Como autor quiero recibir los mensajes sin spam.
**Reglas de negocio:**
- El formulario funciona antes de cargar JavaScript.
- Los errores se muestran junto a cada campo.
- Se confirma el envío con un mensaje claro.
- El servicio alojado filtra el spam.
**Fuera de alcance:**
- Agenda de reuniones.
- Chat en vivo.
**Preguntas abiertas:**
- ¿Hace falta una casilla de consentimiento?

### FRD-08 · Skill para escribir el blog · Tool
Una skill que convierte notas en un borrador en la voz del autor.
**Resumen:** baja el costo de escribir: de notas sueltas a un borrador revisable.
**Historias de usuario:**
- Como autor quiero pasar mis notas y recibir un esquema.
- Como autor quiero un borrador en los dos idiomas.
- Como autor quiero que se revisen enlaces y datos.
**Reglas de negocio:**
- La skill nunca publica sola; deja un borrador.
- Todo dato del borrador enlaza a su fuente.
- La voz sigue la guía de estilo del autor.
- El borrador marca lo que necesita revisión humana.
- La skill registra cada borrador generado.
**Fuera de alcance:**
- Publicación automática.
- Imágenes generadas.
**Preguntas abiertas:**
- ¿La skill propone títulos o los deja al autor?

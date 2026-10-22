---
proyecto: "Funko Tracker"
fase: "product"
---

> Un catálogo visual de figuras coleccionables para saber qué tienes, qué te falta y compartirlo en una sola imagen.

## 📋 PRD

### El problema
- **Variantes que se confunden** — la misma figura sale en cinco ediciones casi idénticas y nadie sabe cuál tiene.
- **Listas en papel** — los coleccionistas llevan su inventario en notas del teléfono que no se pueden compartir.
- **Catálogos incompletos** — las fuentes oficiales no muestran las exclusivas de tienda ni las reediciones.

### Hipótesis de valor
Si encontrar una figura y marcarla como "la tengo" toma menos de diez segundos, el coleccionista vuelve cada semana y comparte su lista con su grupo.

### Usuarios
- **Coleccionista casual** — compra dos o tres figuras al mes y quiere evitar duplicados.
- **Coleccionista dedicado** — persigue series completas y lleva metas por franquicia.
- **Curador del catálogo** — revisa la carga de nuevas figuras antes de publicarlas.

### Métricas de éxito
- **Activación** — 60 % de las cuentas nuevas marca al menos cinco figuras en su primera visita.
- **Retención semanal** — 35 % vuelve en la semana siguiente.
- **Compartidos** — 1 de cada 4 coleccionistas exporta una lista en su primer mes.
- **Calidad del catálogo** — menos de 2 % de fichas reportadas como incorrectas.

### Alcance v1
- Catálogo por franquicia y serie
- Ficha con variantes
- Cuenta con enlace mágico
- Colección privada
- Metas por serie
- Lista exportable como imagen
- Carga inicial revisada
- Avisos de novedades

### Fuera del v1
- Marketplace o compraventa
- Precios en tiempo real
- App nativa
- Comunidad y comentarios

### Decisiones abiertas
- **Fuente de imágenes** — ¿enlazar las oficiales o alojar copias con licencia?
- **Formato del póster** — ¿una imagen larga o varias páginas cuando la lista pasa de cien figuras?
- **Moderación** — ¿quién aprueba una ficha nueva antes de publicarla?
- **Analítica** — ¿se instrumenta desde el día uno o tras el lanzamiento?

## 🔬 Research

### Referentes
- **Apps oficiales de marca** — buen catálogo visual, pero sin variantes de tienda ni exportación.
- **Bases de datos comunitarias** — muy completas y difíciles de leer en el teléfono.
- **Hojas de cálculo compartidas** — flexibles, pero nadie las mantiene al día.
- **Grupos de mensajería** — donde de verdad se comparten las listas, como capturas sueltas.

### Hallazgo clave
El momento de uso es la tienda: el coleccionista abre la app con una figura en la mano y necesita la respuesta antes de llegar a la caja.

### La carga en dos momentos
Primero se carga el catálogo histórico de cada franquicia con revisión humana; después un vigilante horario detecta novedades y las deja en cola.

### Calidad del catálogo
Cada ficha guarda su fuente y su licencia de imagen; una ficha sin fuente no se publica.

## 🧩 FRDs

### FRD-01 · Recorrer el catálogo · UI
Explorar franquicias, series y figuras con búsqueda y filtros.
**Resumen:** la entrada principal: encontrar una figura en segundos, también desde el teléfono.
**Historias de usuario:**
- Como coleccionista quiero buscar por nombre o número de caja para encontrar la figura que tengo en la mano.
- Como coleccionista quiero filtrar por serie y año para ver solo lo que me interesa.
**Reglas de negocio:**
- Las variantes se muestran como insignias, nunca como fichas duplicadas.
- La búsqueda responde en menos de 300 ms con el catálogo cargado.
**Fuera de alcance:**
- Búsqueda por foto.
**Preguntas abiertas:**
- ¿Hace falta ordenar por popularidad en el v1?

### FRD-02 · Ficha de la figura · UI
Todo lo que distingue a una figura: variantes, ediciones y créditos de imagen.
**Resumen:** la ficha responde "¿cuál de todas es la mía?".
**Historias de usuario:**
- Como coleccionista quiero cambiar de variante sin salir de la ficha.
**Reglas de negocio:**
- Toda imagen muestra su crédito y su fuente.
**Fuera de alcance:**
- Precios de reventa.
**Preguntas abiertas:**
- ¿Mostramos reediciones como variantes o como ediciones?

### FRD-03 · Cuenta y colección privada · UI
Iniciar sesión sin contraseña y marcar lo que tengo.
**Resumen:** la colección es privada por defecto y se puede borrar entera.
**Historias de usuario:**
- Como coleccionista quiero marcar "la tengo" desde cualquier tarjeta.
**Reglas de negocio:**
- Borrar la cuenta elimina la colección en menos de 24 horas.
**Fuera de alcance:**
- Colecciones compartidas entre varias personas.
**Preguntas abiertas:**
- ¿Guardamos el estado de la caja como texto libre o como lista cerrada?

### FRD-04 · Metas y faltantes · UI
Metas por serie y la lista de lo que me falta.
**Resumen:** convierte la colección en un objetivo visible.
**Historias de usuario:**
- Como coleccionista dedicado quiero ver cuánto me falta para completar una serie.
**Reglas de negocio:**
- Una meta se calcula con las figuras publicadas de la serie, no con las anunciadas.
**Fuera de alcance:**
- Alertas de precio.
**Preguntas abiertas:**
- ¿Las exclusivas de tienda cuentan para completar la serie?

### FRD-05 · Lista para compartir · UI
Exportar la colección como una imagen legible para grupos de mensajería.
**Resumen:** el canal de crecimiento: cada lista compartida lleva el nombre de la app.
**Historias de usuario:**
- Como coleccionista quiero exportar solo lo que me falta para pedirlo en mi grupo.
**Reglas de negocio:**
- La imagen se genera en segundo plano y se avisa cuando está lista.
**Fuera de alcance:**
- Exportar a PDF.
**Preguntas abiertas:**
- ¿Cuántas figuras caben antes de partir el póster?

### FRD-06 · Carga inicial del catálogo · Infra
Cargar el histórico de cada franquicia con revisión humana.
**Resumen:** sin un catálogo confiable la app no sirve; esta carga se revisa antes de publicarse.
**Historias de usuario:**
- Como curador quiero revisar cada lote antes de que llegue al catálogo público.
**Reglas de negocio:**
- Una ficha sin fuente ni licencia de imagen no se publica.
**Fuera de alcance:**
- Carga automática sin revisión.
**Preguntas abiertas:**
- ¿Qué franquicias entran en la primera carga?

### FRD-07 · Novedades del catálogo · Infra
Detectar figuras nuevas cada hora y dejarlas en cola.
**Resumen:** mantiene el catálogo vivo sin trabajo manual diario.
**Historias de usuario:**
- Como curador quiero un resumen diario de novedades por revisar.
**Reglas de negocio:**
- Una novedad nunca se publica sin pasar por la cola de revisión.
**Fuera de alcance:**
- Notificaciones a los coleccionistas.
**Preguntas abiertas:**
- ¿El vigilante corre cada hora o dos veces al día?

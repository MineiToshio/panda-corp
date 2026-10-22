# Decisiones pendientes — bandeja del owner

Cada bloque es una pregunta para ti; el motor no avanza ese punto hasta que respondas.

## 2026-09-10 · Textos del inicio y de "sobre mí" — 2 de 4 ajustes listos, faltan 2

**Contexto:** una persona que revisó el sitio pidió cuatro ajustes de texto. El motor ya aplicó dos (la frase del inicio y el orden de las pruebas). Los otros dos cambian cómo te presentas y necesitan tu voz: el primer párrafo de "sobre mí" y el texto del botón de contacto.

**Qué necesito de ti:** elige una de las dos versiones propuestas para cada texto, o escribe la tuya.

- **Estado:** PENDIENTE
- **Recomendación:** la versión B del párrafo de "sobre mí" (más corta) y dejar el botón como está.

## 2026-07-01 · FRD-07 Contacto · falta la clave pública del servicio de formularios (necesita tu acción)

**Estado:** ✅ RESUELTO el 2026-07-03 — la clave quedó en el entorno de producción y el formulario envía bien.

**Contexto:** el gate rechazaba el recorrido de contacto porque la variable pública del servicio de formularios estaba vacía en el entorno de pruebas. El código estaba bien; faltaba el valor, que solo puedes obtener tú desde tu cuenta del servicio.

**Qué necesito de ti (1 acción):** copiar la clave pública desde el panel del servicio y guardarla en el entorno.

**Recomendación:** guardar la clave pública real; mientras tanto el gate local puede usar la clave de prueba del servicio.

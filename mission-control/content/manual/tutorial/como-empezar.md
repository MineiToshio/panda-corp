---
title: "Cómo empezar"
group: tutorial
order: 1
---

# Cómo empezar

Bienvenido a Pandacorp — la fábrica de software 100 % IA. Esta guía lleva a una persona sin contexto previo desde cero hasta ejecutar su primer comando.

## Qué necesitas antes de empezar

- **Claude Code** instalado y con cuenta activa (`claude --version`).
- El repositorio de la fábrica clonado localmente:

  ```
  git clone <repo-url> panda-corp
  cd panda-corp
  ```

- El plugin Pandacorp instalado en tu sesión de Claude Code:

  ```
  claude plugin install pandacorp@panda-corp
  ```

  El plugin añade todas las habilidades `/pandacorp:*` a tu sesión.

## Primer arranque — configurar la fábrica

Desde la carpeta raíz del repositorio, ejecuta:

```
/pandacorp:onboarding
```

El asistente te pregunta tu nombre, tu cuenta de GitHub y la ruta base donde vivirán los proyectos. Cuando termina, genera `factory/profile.md` (gitignoreado — es tuyo, nunca se commitea).

## Tu primera idea

1. Usa `/pandacorp:explore <tema>` para conversar una idea difusa hasta que tome forma.
2. Cuando la idea esté clara, ejecuta `/pandacorp:new-idea` para cristalizarla en una tarjeta en `factory/ideas/`.
3. Abre Mission Control para ver la tarjeta en el tablero de ideas.

## Primera construcción

Una vez elegida una idea:

```
/pandacorp:spec <nombre-de-la-idea>
```

Esto crea el proyecto (carpeta hermana + repo) y genera el PRD + los FRDs.

Luego, dentro del proyecto:

```
cd <ruta-del-proyecto>
/pandacorp:design
/pandacorp:architecture
/pandacorp:implement
```

`implement` orquesta la construcción de forma autónoma. Mission Control muestra el avance en tiempo real.

## A continuación

- **Conceptos:** lee "Qué es Pandacorp" para entender la filosofía de la fábrica.
- **El pipeline:** "El pipeline" explica cada fase de product → release.
- **Guías:** "Cómo operas a diario" cubre la rutina diaria de trabajo.

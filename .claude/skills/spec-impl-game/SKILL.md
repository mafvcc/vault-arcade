---
name: spec-impl-game
description: Implementa un spec de juego aprobado reutilizando /spec-impl y, al terminar la implementación, encadena automáticamente skin-designer y mobile-porter (secuencial, nunca en paralelo) sobre el juego implementado.
disable-model-invocation: true
argument-hint: <NN-game-name>
---

# /spec-impl-game — Implementa un spec de juego y aplica skins + mobile

Este skill es el flujo **completo** para un juego nuevo: implementa el spec y, al
terminar, deja el juego con los 3 skins canónicos y los controles táctiles mobile.

Tus respuestas deben estar siempre en el **mismo idioma que el prompt inicial** (si el
usuario escribe en español, responde en español).

El argumento recibido es: `$ARGUMENTS` (nombre del spec, p. ej. `07-tetris-game`, `07`, o
`tetris-game`).

---

## Fase A — Implementación (delegar en /spec-impl)

Este skill **no redefine** la lógica de implementación. Lee y sigue al pie de la letra
`.claude/skills/spec-impl/SKILL.md` (sus Fases 1 → 4) usando `$ARGUMENTS` como nombre del
spec:

1. **Fase 1** — identificar el spec en `specs/` a partir de `$ARGUMENTS`.
2. **Fase 2** — validar que el estado **signifique "Aprobado"** (en cualquier idioma). Si
   no lo está, aplica el bloqueo de spec-impl (muestra su mensaje de error estándar) y
   **detente aquí**: no crees rama, no toques código y **no lances ningún agente**.
3. **Fase 3** — crear/cambiar a la rama `spec-NN-slug` y mostrar el resumen del spec.
4. **Fase 4** — implementar paso a paso con pausas, exactamente como indica spec-impl,
   hasta su mensaje final `✅ All steps of the plan are implemented`.

No avances a la Fase B hasta que la Fase 4 de spec-impl haya terminado por completo.

---

## Fase B — Post-implementación: skins y mobile (automática)

Se ejecuta **solo** cuando la Fase 4 llegó a su mensaje final. No pidas confirmación
intermedia: encadena los agentes automáticamente.

### B.1 — Derivar el game-id

Los specs de juego siguen el patrón `NN-<id>-game.md` (ej. `07-tetris-game.md` →
`tetris`). Regla: quita el prefijo numérico `NN-` y el sufijo `-game`; lo que queda es el
`<game-id>`.

- `07-tetris-game` → `tetris`
- `09-pacman-game` → `pacman`

Si el nombre del spec **no** encaja con ese patrón (no puedes aislar un `<game-id>` claro),
**no adivines**: detente y pide al usuario el game-id explícito antes de lanzar agentes.

### B.2 — Lanzar skin-designer (primero)

Lanza el agente con el Agent tool, `subagent_type: skin-designer`, prompt:

```
Aplica skins a <game-id>
```

**Espera a que termine por completo.** No lances mobile-porter todavía.

### B.3 — Lanzar mobile-porter (solo después)

Una vez skin-designer ha finalizado, y en un **bloque de tool-call separado**, lanza el
agente con `subagent_type: mobile-porter`, prompt:

```
Porta <game-id> a mobile
```

Espera a que termine.

> **Regla dura:** los dos agentes corren **secuencialmente, nunca en paralelo**.
> Está prohibido invocarlos en el mismo bloque de tool-calls. mobile-porter no arranca
> hasta que skin-designer haya finalizado.

### B.4 — Cierre

Resume al usuario:

- Spec implementado y rama activa (`spec-NN-slug`).
- Skins aplicados — resumen breve devuelto por skin-designer.
- Mobile portado — resumen breve devuelto por mobile-porter.
- Recordatorio heredado de spec-impl: verificar los criterios de aceptación uno por uno
  y, si pasan, cambiar el estado del spec a "Implementado" antes del commit final / merge.

---

## Reglas invariantes

- **No duplicar la lógica de spec-impl.** La fuente única de las 4 fases de
  implementación es `.claude/skills/spec-impl/SKILL.md`.
- **Si el estado del spec no significa "Aprobado"**, se aplica el bloqueo de spec-impl y
  los agentes **nunca** se ejecutan.
- **Agentes secuenciales, nunca en paralelo:** skin-designer primero, mobile-porter
  después, en bloques de tool-call separados.
- **Un juego por corrida.**

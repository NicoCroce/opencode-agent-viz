# Plan: pendientes tras el cierre de deudas y permisos

> **Estado:** abierto (2 features + 1 endurecimiento opcional).
> **Fecha:** 2026-10-14 · **Base:** `main` @ `cadefbb`.
> **Origen:** barrido de memoria + repo (verificado, no supuesto). Ver §5.

## 1. Alcance

Lo que **falta implementar** son las dos features v2 del chat (inbox/cola y adjuntos), más un
endurecimiento de permisos de una línea. Todo lo que era *deuda de cierre* está mergeado y no
se vuelve a auditar (§4).

Restricciones comunes: la Constitución (principio III, todo por la fachada; principio IV, no
redefinir tipos del SDK), `AGENTS.md` (arquitectura por dominios), y el flujo SddOrch por
fascículos: **una rama y un PR por feature**.

## 2. Lo que falta implementar

### 2.1 Fascículo 2 — Inbox / cola del chat (`feat/chat-inbox`)

**Qué falta funcionalmente.** La feature 009 resolvió el envío pidiendo `delivery: 'queue'` cuando
la sesión está ocupada, pero el visor **no muestra la cola ni permite cancelarla**. Si el TUI y el
visor escriben la misma sesión, el turno queda encolado en el servidor y desde el visor no hay
señal alguna: el usuario no sabe si su prompt se envió ni puede retirarlo.

**Superficie del SDK — verificada** sobre `@opencode/client@2.0.22` (no re-verificar):

| Método | Firma | Fuente |
|---|---|---|
| `session.inbox.list` | `({sessionID}) → SessionInboxInfo[]` | `promise/client.d.ts:61-65`; tipos `types.d.ts:6151-6183` |
| `session.inbox.cancel` | `({sessionID, inboxID}) → void` | idem |
| `session.inbox.update` | `({sessionID, inboxID, delivery: "steer" \| "queue"}) → void` | idem |
| `session.prompt` | acepta `delivery: "steer" \| "queue" \| null`, `resume`; devuelve `SessionInboxUser` | `types.d.ts:5494-5778` |

No existe `remove` ni `clear`: `cancel` es el equivalente.

**Preguntas abiertas (para `clarify` / research).** No se responden por suposición:

1. ¿El servidor emite eventos SSE de cola (encolar / consumir / cancelar) o hace falta
   refetch tras cada mutación y al recuperar foco?
2. ¿`SessionInboxInfo` trae el texto del prompt encolado, el autor (TUI vs visor) y timestamp?
3. ¿Se puede cancelar un turno **ya en ejecución** o solo los que siguen encolados?
4. ¿El `id` de `SessionInboxUser` es el `inboxID` que espera `cancel`?

**Alcance probable (a validar en `plan`).**

- Servicio read+write por la fachada (Constitución III).
- Query key de inbox; invalidación tras `cancel` / `update` y al terminar un turno.
- UI: sección «En cola (n)» en el panel de Chat, con texto y hora por item, botón de cancelar
  (`isLoading={isPending}`) y toggle `steer`/`queue`.
- Los cuatro estados de pantalla explícitos (error / loading / vacío / datos).
- Tests: reglas puras, servicio con cliente mockeado, componente con `renderWithProviders`,
  fixture real de `inbox.list` (y del evento de cola si existe).
- **E2E de frontera:** encolar desde el visor con la sesión ocupada → aparece en la cola →
  cancelar → desaparece.

**Riesgo principal.** Carrera entre el evento/refetch y la mutación: items duplicados o fantasma.

**Nivel y roles.** SDD completo. Nivel 1; roles `ux` + `quality` (`security` solo si aparece riesgo).

### 2.2 Fascículo 3 — Adjuntos en el compositor (`feat/chat-attachments`)

**Qué falta funcionalmente.** El composer acepta **solo texto** (FR-023 de 009; decisión #619
difirió los adjuntos). No se puede enviar una captura ni un fichero al agente desde el visor.

**Superficie del SDK — verificada:**

- `session.prompt({ …, files?: ReadonlyArray<{uri; name?; description?; mention?}> })`.
- `PromptFileAttachment { data: base64; mime; source: {type: "inline"} | {type: "uri", uri}; … }`
  (`types.d.ts:823-830`).
- **No existe** `upload` / `artifact` / `storage`. Sí existe `file.write({location?, path, payload:
  Uint8Array})` (`client.d.ts:173`), que escribe bytes en el **filesystem del servidor**.

**Bloqueante de diseño — resolver ANTES de especificar.** ¿Qué acepta `files[].uri`?

- **Data URI** (`data:mime;base64,…`) → el navegador manda el contenido; camino limpio, sin tocar
  el FS del servidor.
- **Ruta local del servidor** → habría que subir con `file.write` a un temporal; eso es escritura
  en el FS del servidor, con limpieza, límites y una superficie de riesgo muy distinta.

De esta respuesta depende el nivel de la feature y el plan entero. Es investigación previa
obligatoria (researcher con acceso al runtime del SDK).

**Alcance probable (a validar).** Selector de archivos + drag&drop + pegar; lista de adjuntos con
opción de quitar; límites de tamaño (base64 infla ~33 %) y de tipos; nombres de archivo maliciosos;
manejo de errores; los cuatro estados de pantalla.

**Nivel y roles.** SDD completo. Nivel 2; roles `security` + `ux` + `quality`.

### 2.3 Endurecimiento opcional — `edit *tasks.md` (1 línea)

El implementer no puede editar `tasks.md` con `edit` (regla intencional), pero **sí puede hacerlo
por shell**: en la unidad U03 de `20261013-cierre-deudas` lo esquivó escribiendo con `python3`.
Decisión del owner: o se deniega también la escritura por shell, o se acepta como guarda blanda.

## 3. Orden y empaquetado

1. **Fascículo 2** (inbox) — sesión nueva, rama `feat/chat-inbox`.
2. **Fascículo 3** (adjuntos) — sesión nueva, rama `feat/chat-attachments`, **después** del 2.

Los dos tocan el mismo dominio (`Chat/`), así que van **en secuencia, no en paralelo**: el segundo
rebasaría con conflicto de archivos.

Prompt de arranque para el fascículo 2:

> Retomá SddOrch. Leé `sddorch/pendientes/chat-v2` en Engram. Fascículo 2: inbox/cola del chat.
> SDD completo, nivel 1, roles `ux` + `quality`.

El plan y la superficie del SDK también viven en Engram (`sddorch/pendientes/chat-v2`), así que la
sesión nueva no repite el relevamiento.

## 4. Cerrado — no volver a auditar

| Qué | Cómo |
|---|---|
| Deudas de cierre 012-014 | PR #27 (squash `ac36a7f`) |
| Permisos de subagentes | PR #28 (squash `79e5e68`) |
| Reversión de `edit specs/*` del tester | PR #29 (squash `cadefbb`) |
| `Improves-3.1.md` bloques A-D | ejecutados (C como feature 012) |
| `consolidacion/plan-priorizado.md` | ejecutado — sus 6 ficheros de «código muerto a eliminar» ya no existen |
| `fix-session-list-parent-window.md` | implementado en la feature 011 |
| Checkboxes sueltos de `specs/001..008` | validaciones manuales viejas / un «NO APLICA» |

No hay roadmap ni specs sin implementar.

## 5. No es implementación

- **§7 de `specs/014-inspector-detail-tabs/verification.md`.** Verificación **manual en navegador**:
  ratios renderizados, `forced-colors` real, ancho de etiquetas a 280/720 px, teclado real. jsdom no
  puede medirlo y no hay ninguna tarea de código asociada: SC-003 y SC-006 quedan «parcial».
  Checklist: `.opencode/runs/20261013-cierre-deudas/checklist-s7-014.md`. Al volver el resultado, se
  anexa a `verification.md` sustituyendo el veredicto «no ejecutable».
- **`docs/internal/proposals/Improves-3.1.md`.** Sigue diciendo `**Estado:** propuesto` aunque sus
  bloques A-D se ejecutaron. Corregir el estado.

## 6. Sueltos menores

- 2 stashes viejos en el repo (`stash@{0}` WIP on `main` de un commit antiguo, `stash@{1}` de la
  rama 004) y ~26 ramas locales ya mergeadas. Limpieza **solo con OK del owner**; nunca automática.

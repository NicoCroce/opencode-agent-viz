# Research — Reordenar y agrupar el panel de detalles

**Feature**: `004-inspector-panel-layout`
**Date**: 2026-10-07
**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

La spec está cerrada con clarificaciones (checklist de requisitos al 100%): **no quedan `NEEDS CLARIFICATION`**. Este documento resuelve las decisiones técnicas de implementación. Todas se apoyan en el código ya existente del dominio `Inspector`, sin dependencias nuevas.

---

## R1. Cómo imponer y verificar el orden de las secciones (US1, FR-001, SC-003)

**Decision**: Componer el orden de forma **explícita en JSX** dentro de `InspectorPanel.tsx` (una sección por componente, en el orden exacto de FR-001) y verificar el orden con un test que lea el DOM (`document` order de los encabezados).

**Rationale**: Las secciones tienen props heterogéneas (`metrics`, `resources`, `tools`, `tasks`, `parallelPeers`, `errors`, …). Un registro de secciones dirigido por configuración obligaría a un `switch`/`map` con props especiales por clave, añadiendo indirección sin ganar claridad. JSX explícito deja el orden a la vista y el test lo blinda contra regresiones. La cabecera de identidad se mantiene arriba (FR-002), fuera del bloque reordenado.

**Alternatives considered**:
- Registro/array de secciones con metadatos: descartado por la heterogeneidad de props (indirección sin beneficio).
- Un único componente monolítico ordenado a mano dentro de `InspectorPanel`: descartado porque impide mantener cada sección como componente puro y testeable.

---

## R2. Extraer "Duración mediana por herramienta" de `ToolHistory` (FR-006, FR-013)

**Decision**: Crear `ToolStats.tsx` como sección independiente que recibe `tools: TToolHistoryEntry[]`, calcula con la función pura existente `medianToolDurations(tools)` y renderiza `TToolStat[]` (nombre, nº de llamadas, mediana o "no disponible"). `ToolHistory.tsx` **elimina** el bloque `<Container data-testid="tool-history-stats">` y conserva solo la lista de ejecuciones y su control de expansión.

**Rationale**: La mediana hoy vive **dentro** de `ToolHistory` (líneas 88-109) pero la spec la exige como sección propia fuera de "Avanzado" (FR-006) y las Herramientas dentro de "Avanzado" sin la mediana (FR-013). La lógica de agregación ya es pura y está testeada (`lib/medianToolDurations.ts` + spec); solo se mueve su presentación, sin duplicar cálculo. `ToolStats` queda como presentación pura y reutiliza el mismo formato (`formatDuration`, `callsLabel`).

**Alternatives considered**:
- Mantener la mediana en `ToolHistory` y renderizarla dos veces: descartado (duplicaría un bloque y violaría FR-013).
- Calcular la mediana en el hook `useInspectorData`: descartado; la función pura ya existe y el hook no debe ganar responsabilidades de presentación.

**Nota de consistencia**: `ToolStats` debe mostrar estado vacío explícito cuando no hay herramientas (misma cadena ya usada: "Sin actividad de herramientas todavía."). Los tests que hoy verifican la mediana en `ToolHistory.spec.tsx` se trasladan a `ToolStats.spec.tsx`.

---

## R3. Mecanismo del desplegable "Avanzado" (US2, FR-010..FR-012)

**Decision**: Implementar `AdvancedSection.tsx` como un **disclosure accesible** con un `Button` que expone `aria-expanded` y `aria-controls`, y una región con `role="region"` e `id` asociado. El **contenido se renderiza condicionalmente** (no se oculta con CSS). El estado es **local no controlado** con `useState(false)` (colapsado por defecto), siguiendo el patrón ya usado por `FileChanges` (selección local) y `ToolHistory` (expansión local con `Button` + chevron + `aria-expanded`). Sin dependencias nuevas.

**Rationale**: 
- La spec exige un desplegable cerrado por defecto y abrible por acción explícita (FR-010, FR-012) y que su contenido **no sea visible** al inicio (FR-011, SC-002). El render condicional garantiza que colapsado las subsecciones no estén en el DOM, lo que además evita montar trabajo innecesario.
- Es coherente con la dirección "flat": el control es una fila sin caja, igual que "Ver N más" de `ToolHistory`. No se introducen tarjetas ni animaciones.
- Un `useState` local mantiene el patrón de estado de vista de los componentes del dominio (Principio II/VI) y es directamente testeable con `userEvent`.

**Alternatives considered**:
- Radix `Accordion`/`Collapsible` (ya instalado `@radix-ui/react-accordion`): funcional, pero añade estilos/animation de tarjeta ajenos a la dirección visual y un wrapper compartido para un único consumidor; descartado por sobre-ingeniería.
- `<details>/<summary>` nativo: accesible y sin estado React, pero el estado abierto/cerrado lo gestiona el DOM, complica controlar la persistencia con intención explícita y difiere del patrón de `Button` ya usado en el dominio; descartado.
- Nueva dependencia (`react-collapsible`): innecesaria; descartada.

**Accesibilidad (criterio de aceptación)**: el disparador tiene nombre accesible "Avanzado"; `aria-expanded` = `false` colapsado / `true` expandido; el contenido se asocia vía `aria-controls`. Al colapsar, el contenido deja de existir en el DOM.

---

## R4. Agrupar tareas + paralelos en "Subagentes" (US3, FR-007, FR-008)

**Decision**: Crear `SubagentsSection.tsx` que recibe `tasks: TTaskEntry[]` y `parallelPeers: TGraphNode[]` y renderiza **un único encabezado "Subagentes"** con ambos contenidos (tareas con su estado y descripción; peers con `StatusDot` + título). Con ambos vacíos muestra un estado vacío explícito.

**Rationale**: Hoy `InspectorPanel` renderiza por separado "En paralelo (N)" (solo si hay peers, líneas 174-190) y "Tareas del subagente" (líneas 203-225). La spec pide unificarlas bajo "Subagentes" con estado vacío explícito. Agrupar en un componente mantiene `InspectorPanel` como mero orquestador y hace testeable la regla de vacío.

**Alternatives considered**:
- Mantener ambos bloques separados y solo renombrar: descartado (FR-007 pide un único encabezado).
- Incluir "En paralelo" dentro de "Subagentes" solo cuando hay peers y tareas aparte: descartado (dos encabezados de nuevo; rompe US3).

**Decisión de estado vacío**: "Sin subagentes ni agentes en paralelo." (texto explícito, siguiendo el tono de "Sin tareas de subagente." actual). El texto exacto se fija en el contrato de UI.

---

## R5. Errores como sección propia dentro de "Avanzado" (FR-015)

**Decision**: Extraer el bloque de errores hoy inline en `InspectorPanel` (líneas 227-242) a `ErrorsSection.tsx` (`errors: { message: string; at: number }[]`), con estado vacío explícito "Sin errores." y el mismo estilo (`text-status-error`). Se monta como cuarta subsección de "Avanzado".

**Rationale**: FR-011 fija el orden interno de "Avanzado" (Herramientas → Respuestas → Preguntas y permisos → Errores) y FR-015 exige que Errores esté dentro y con estado vacío. Extraerlo permite testearlo aislado y mantiene `InspectorPanel` limpio.

**Alternatives considered**:
- Dejar los errores inline dentro de `AdvancedSection`: descartado; mezcla presentación de datos con el contenedor del disclosure y dificulta el test de orden interno.

---

## R6. Persistencia del estado de expansión entre cambios de nodo (Edge Case)

**Decision**: El estado de expansión de "Avanzado" vive en `AdvancedSection` con `useState(false)`. Como `InspectorPanel` **no desmonta** `AdvancedSection` al cambiar de un nodo a otro (solo cambian las props), el estado se conserva durante la sesión de UI, como pide la spec. Se reinicia al abrir la app y cuando `node === null` (el panel devuelve el mensaje "Selecciona un nodo…" y no monta secciones).

**Rationale**: Cubre exactamente la assumption "se conserva expandido/colapsado solo mientras dura la sesión de UI". Se evita subir el estado a un padre/hook porque no aporta valor en este alcance (un solo nodo visible a la vez).

**Alternatives considered**:
- Elevar el estado a `WorkspacePage`/hook: descartado; acopla el panel a un orquestador que no necesita conocer esta UI.
- Persistir en `localStorage`: descartado explícitamente por la spec (se reinicia al abrir la app).

---

## R7. Preservación de estados de pantalla (FR-016, Principio VI)

**Decision**: No se altera la obtención ni los flags de estado. Cada sección mantiene `isError`/`isLoading`/vacío/datos como hoy:
- `QuestionsSection` y `FileChanges` ya renderizan error→loading→vacío→datos.
- `ErrorsSection` conserva su estado vacío ("Sin errores."). Un error de carga de mensajes ya se refleja donde corresponde; la sección no inventa un loading nuevo.
- `SubagentsSection` renderiza estado vacío explícito cuando no hay tareas ni peers.
- `ToolStats` renderiza estado vacío explícito sin herramientas.

**Rationale**: La feature no cambia datos; garantizar que ninguna sección pierda sus estados es requisito explícito (FR-016, SC-004) y evita regresiones.

**Alternatives considered**:
- Añadir loaders nuevos a "Avanzado": descartado; ocultaría los estados propios de cada subsección y no es lo pedido.

---

## R8. Sin cambios de datos, SDK, hooks ni eventos (Assumptions)

**Decision**: No se tocan `Inspector.entity.ts`, `Inspector.service.ts`, `useInspectorData.ts`, `Inspector.service.spec.tsx`, `queryKeys.ts`, el reducer de eventos ni `Infrastructure`. No se añaden endpoints ni se procesan deltas.

**Rationale**: La spec acota la feature a "organización y visibilidad" (Assumptions, Key Entities). Mantener el origen de datos intacto protege Principios I, III y VII y minimiza el riesgo.

**Alternatives considered**:
- Reorganizar los datos en el hook (p. ej. precomputar subagentes): innecesario; los datos ya están disponibles (`tasks`, `parallelPeers`, `tools`) en el punto de composición.

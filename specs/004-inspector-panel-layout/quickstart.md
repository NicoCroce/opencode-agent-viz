# Quickstart — Reordenar y agrupar el panel de detalles

**Feature**: `004-inspector-panel-layout`
**Objetivo**: validar de extremo a extremo que el panel de detalles presenta las secciones en el orden pedido y que "Avanzado" agrupa y oculta el contenido técnico por defecto.

Referencias: [spec.md](./spec.md) · [plan.md](./plan.md) · [contracts/inspector-layout-contract.md](./contracts/inspector-layout-contract.md) · [data-model.md](./data-model.md).

---

## Prerrequisitos

- Node.js y dependencias instaladas: `npm install`
- Para la validación manual en navegador: una instancia de OpenCode server accesible vía el proxy de Vite (`OPENCODE_URL`), tal y como ya usa la app. El panel necesita una sesión con al menos un nodo en el grafo.

---

## 1. Validación automatizada (obligatoria)

```bash
# Tests del dominio tocado
npx vitest run src/Domains/Inspector

# Suite completa + tipos + lint (puerta de calidad del repo)
npm test
npm run tsc
npm run lint
```

**Esperado**: verde. Los specs de `InspectorPanel`, `ToolStats`, `SubagentsSection`, `AdvancedSection` y `ErrorsSection` cubren los criterios de abajo.

---

## 2. Validación manual (navegador)

```bash
npm run dev
```

Abrir la app, seleccionar una sesión y **seleccionar un nodo** en el grafo.

### US1 — Orden de secciones (FR-001..FR-006)

1. Con un nodo seleccionado, recorrer el panel de arriba a abajo.
2. **Esperado**: la cabecera de identidad primero, y después exactamente:
   `Modelo` → `Métricas` → `Recursos` → `Duración mediana por herramienta` → `Subagentes` → `Archivos` → `Avanzado`.
3. Si el nodo tiene evidencia de reintentos, el aviso de **Loop** aparece **dentro de Métricas**.

> Mapea a **SC-001** (las seis primeras secciones se localizan sin abrir ningún desplegable) y **SC-003** (orden 100% coincidente).

### US2 — "Avanzado" colapsado por defecto (FR-010..FR-015)

1. Al mostrar el panel por primera vez, comprobar que **Herramientas**, **Respuestas**, **Preguntas y permisos** y **Errores** **no** son visibles.
2. Pulsar el control `Avanzado`.
3. **Esperado**: aparecen, en este orden: `Herramientas` → `Respuestas` → `Preguntas y permisos` → `Errores`, y el control queda `aria-expanded="true"`.
4. Pulsar de nuevo.
5. **Esperado**: el contenido se oculta y el resto del panel no cambia de orden.
6. Cambiar a otro nodo y volver: el estado expandido/colapsado se conserva durante la sesión.

> Mapea a **SC-002** (contenido técnico oculto por defecto, requiere acción).

### US3 — "Subagentes" agrupado (FR-007, FR-008)

1. Seleccionar un nodo con tareas de subagente y/o agentes en paralelo.
2. **Esperado**: ambos contenidos aparecen bajo el **único** encabezado `Subagentes`.
3. Seleccionar un nodo sin ninguno de los dos.
4. **Esperado**: `Subagentes` muestra un estado vacío explícito y no desaparece.

> Mapea a **FR-008** y a la cobertura de contenido de **SC-004**.

### Edge cases

- **Nodo sin datos**: cada sección muestra su estado vacío explícito sin romper el orden.
- **Duración mediana sin tiempos**: las herramientas sin `startedAt`/`endedAt` muestran `no disponible` en "Duración mediana por herramienta".
- **Sin nodo**: se mantiene el mensaje "Selecciona un nodo del grafo para ver su detalle.".
- **Cambio de nodo**: el contenido se recompone; el estado de "Avanzado" se conserva.

---

## 3. Criterios de aceptación (resumen)

| Criterio | Cómo se valida |
|----------|----------------|
| FR-001 | Orden del DOM exacto (test + inspección). |
| FR-002 | Cabecera de identidad la primera. |
| FR-003..FR-009 | Secciones presentes con su contenido y posición. |
| FR-010..FR-012 | `AdvancedSection`: colapsado por defecto, `aria-expanded`, contenido desmontado. |
| FR-013 | Herramientas no muestra la mediana; la mediana vive en su sección. |
| FR-014/FR-015 | Respuestas y Errores conservan su comportamiento y vacío. |
| FR-016 / SC-004 | Cada sección mantiene error→loading→vacío→datos; 0 regresiones de contenido. |

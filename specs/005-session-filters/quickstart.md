# Quickstart — Filtros de proyecto y recencia en el listado de sesiones

**Feature**: `005-session-filters`
**Objetivo**: validar de extremo a extremo que la página del listado permite acotar por proyecto y por recencia, que ambos filtros se combinan, que sobreviven a la navegación/recarga y que la ventana temporal se recalcula en vivo.

Referencias: [spec.md](./spec.md) · [plan.md](./plan.md) · [contracts/session-filters-contract.md](./contracts/session-filters-contract.md) · [data-model.md](./data-model.md).

---

## Prerrequisitos

- Node.js y dependencias instaladas: `npm install`.
- Para la validación manual en navegador: una instancia de OpenCode server accesible vía el proxy de Vite (`OPENCODE_URL`), con sesiones en **al menos dos carpetas de trabajo** y con sesiones de **fechas distintas** (para ejercitar el filtro temporal). Se recomienda tener dos proyectos homónimos (misma carpeta contenedora) si se quiere validar SC-008.

---

## 1. Validación automatizada (obligatoria)

```bash
# Lógica pura de filtros + hook + componentes del dominio
npx vitest run src/Domains/Sessions

# Suite completa + tipos + lint (puerta de calidad del repo)
npm test
npm run tsc
npm run lint
```

**Esperado**: verde. Los specs de `sessionFilters` (parseo/serialización de URL, `isWithinTimeRange`, `filterGroups`, `buildProjectOptions`), `useSessionFilters`, `SessionFilterBar`, `ProjectFilter`, `TimeRangeFilter` y `SessionList` cubren los criterios de abajo.

---

## 2. Validación manual (navegador)

```bash
npm run start   # o npm run dev con OPENCODE_URL/OPENCODE_PASSWORD ya exportados
```

Abrir la app en la ruta del listado (`/sessions`).

### US1 — Filtrar por proyecto (FR-001..FR-005, FR-023, SC-008)

1. Con varios proyectos y ningún filtro, comprobar que se ven **todos** los grupos y que el control de proyecto muestra `Todos` (US1 esc. 1).
2. Abrir el control de proyecto y marcar **un** proyecto.
   - **Esperado**: solo quedan sus sesiones; los grupos del resto desaparecen (US1 esc. 2, FR-005).
3. Marcar un **segundo** proyecto.
   - **Esperado**: se ven las sesiones de ambos y no las de un tercero (US1 esc. 3).
4. Desmarcar hasta no dejar ninguno.
   - **Esperado**: vuelven a verse todos los proyectos (US1 esc. 4, FR-003).
5. Revisar las opciones del control.
   - **Esperado**: solo aparecen proyectos con al menos una sesión; ninguno vacío (FR-004).
6. (Si hay homónimos) abrir el control.
   - **Esperado**: cada opción muestra el nombre de carpeta **y** la ruta completa, distinguibles (US1 esc. 6, FR-023, SC-008).

> Mapea a **SC-001** (dejar visible un único proyecto en ≤ 2 interacciones).

### US2 — Filtrar por recencia (FR-006..FR-009, FR-022, SC-007)

1. Sin filtro temporal, comprobar que el rango activo es `Todo` (US2 esc. 1, FR-008).
2. Elegir `Últimas 24 horas`.
   - **Esperado**: solo sesiones con actividad en las últimas 24 h; el total refleja el filtro (US2 esc. 2/5).
3. Elegir `Última hora`.
   - **Esperado**: solo sesiones con actividad en los últimos 60 min (US2 esc. 3).
4. Volver a `Todo`.
   - **Esperado**: reaparecen todas (US2 esc. 4).
5. Con `Última hora` activo, dejar la página abierta hasta que una sesión visible cruce el límite.
   - **Esperado**: la sesión desaparece **sin tocar nada y sin recargar**, en < 5 s (US2 esc. 6, FR-022, SC-007).
6. Con una ejecución en curso que empezó antes del rango, comprobar que sigue generando actividad.
   - **Esperado**: permanece visible dentro del rango (US2 esc. 7, FR-009).

### US3 — Conservar filtros (FR-013..FR-015, SC-003)

1. Aplicar un filtro de proyecto, abrir una sesión del listado y volver.
   - **Esperado**: el filtro sigue aplicado tal como se dejó (US3 esc. 1).
2. Aplicar un filtro temporal y recargar la página.
   - **Esperado**: el rango se mantiene (US3 esc. 2).
3. Copiar la URL y abrirla en otra pestaña.
   - **Esperado**: misma selección de proyectos y de rango (US3 esc. 3, FR-014).
4. Pulsar **"Limpiar filtros"**.
   - **Esperado**: vuelve el listado completo y la dirección deja de contener filtros (US3 esc. 4, FR-012).

### Combinación, estados y edge cases

- **Intersección**: con un proyecto y un rango activos, comprobar que se cumple **a la vez** proyecto y rango (FR-010, SC-002).
- **Sin resultados**: elegir una combinación proyecto × rango sin sesiones.
  - **Esperado**: estado vacío **de filtros** ("No se encontraron coincidencias") con acción de limpiar; **nunca** "Sin sesiones" (FR-011, SC-005).
- **Limpiar en 1 interacción**: desde el vacío de filtros, recuperar el listado completo con un clic (SC-006).
- **Conteo por grupo**: con filtros activos, cada encabezado de grupo indica cuántas sesiones muestra (FR-016); un grupo sin sesiones no aparece (FR-017).
- **Proyecto inexistente en la URL**: editar la URL con un `projects` desconocido.
  - **Esperado**: se ignora y se muestran los proyectos restantes (o todos si no queda ninguno), sin error (FR-015).
- **Rango inválido en la URL**: `?range=banana`.
  - **Esperado**: cae a `Todo`, sin lista vacía ni error (FR-015).
- **Sin sesiones en absoluto**: con una base vacía, comprobar que se mantiene "Sin sesiones" y **no** aparecen controles de filtro (edge case).
- **Scroll y foco en vivo**: con un rango acotado, usar el control mientras el tiempo avanza.
  - **Esperado**: la lista se recompone sin recargar, sin perder la posición de scroll y sin robar el foco (edge case, FR-022).
- **Filtros mientras cargan los datos**: cambiar un filtro durante la carga.
  - **Esperado**: el filtro se aplica en cuanto llegan las sesiones, sin estado inconsistente (edge case).
- **Teclado/a11y**: operar ambos controles solo con teclado y comprobar que anuncian marcado/rango (FR-021).

> Mapea a **SC-004** (sin filtros, listado idéntico al de hoy: 0 regresiones de contenido ni orden).

---

## 3. Criterios de aceptación (resumen)

| Criterio | Cómo se valida |
|----------|----------------|
| FR-001..FR-005 | Control de proyecto multiselección; opciones solo con sesiones; vacío = todos; intersección. |
| FR-006..FR-009 | Rango predefinido sobre `time.updated`; default `all`; en curso permanece. |
| FR-010 | Proyecto × rango por intersección. |
| FR-011 / SC-005 | `EmptyScreenFilter` accionable, nunca "Sin sesiones". |
| FR-012 / SC-006 | "Limpiar filtros" en 1 interacción. |
| FR-013..FR-015 / SC-003 | URL como fuente; recarga/navegación/compartir; degradación sin error. |
| FR-016 / FR-017 | Conteo por grupo; grupos vacíos ocultos. |
| FR-018 | Filtros solo en la página del listado. |
| FR-019 / SC-004 | error→carga→vacío→datos; 0 regresiones sin filtros. |
| FR-020 | Orden dentro del grupo intacto. |
| FR-021 | Operable con teclado; estado anunciado. |
| FR-022 / SC-007 | Ventana rodante en vivo (< 5 s). |
| FR-023 / SC-008 | Nombre de carpeta + ruta completa en las opciones. |
| FR-024 / FR-025 | Barra siempre visible con resumen y limpiar a la vista. |

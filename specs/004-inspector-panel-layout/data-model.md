# Data Model — Reordenar y agrupar el panel de detalles

**Feature**: `004-inspector-panel-layout`
**Date**: 2026-10-07
**Input**: [spec.md](./spec.md), [research.md](./research.md)

Esta feature **no introduce entidades de datos nuevas** ni cambia el origen de datos (Key Entities de la spec). Es un cambio de organización y visibilidad de la información existente. Por tanto, este documento describe (1) los view-models ya existentes que se reutilizan y (2) el **modelo de composición** del panel (orden de secciones y jerarquía del desplegable), que es lo que la feature realmente define.

---

## 1. Datos reutilizados (sin cambios)

Todos los tipos ya existen en `src/Domains/Inspector/Inspector.entity.ts` y `Graph.entity.ts`. No se añade, renombra ni redefine ninguno (Principio IV).

| Tipo | Origen | Uso en esta feature |
|------|--------|---------------------|
| `TGraphNode` | `Graph.entity.ts` | Nodo seleccionado; identidad, `model`, `metrics`, `sessionId`, `directory`, `status`. |
| `TNodeMetrics` | `Graph.entity.ts` | Sección Métricas (duración, costo, invocaciones, tokens, `hasLoop`, `retryCount`, `loopEvidence`). |
| `TResourceUsage` | `Inspector.entity.ts` | Sección Recursos (MCP, instrucciones, skills, herramientas). |
| `TToolHistoryEntry` | `Inspector.entity.ts` | Lista de ejecuciones (Herramientas) y entrada de `medianToolDurations`. |
| `TToolStat` | `Inspector.entity.ts` | Salida de `medianToolDurations()`; alimenta la sección "Duración mediana por herramienta". |
| `TTaskEntry` | `Inspector.entity.ts` | Tareas del subagente (sección Subagentes). |
| `TGraphNode[]` (`parallelPeers`) | `Graph.entity.ts` | Agentes en paralelo (sección Subagentes). |
| `TFileChange` | `Inspector.entity.ts` | Sección Archivos (sin cambios). |
| `THistoryEntry` | `History.entity.ts` | Sección Respuestas (dentro de Avanzado). |
| `TQuestionEntry`, `TPermissionEntry` | `Inspector.entity.ts` | Sección Preguntas y permisos (dentro de Avanzado). |
| `{ message: string; at: number }[]` | `useInspectorData` | Sección Errores (dentro de Avanzado). |

**Conclusión**: no hay campos nuevos, ni reglas de validación nuevas, ni transiciones de estado nuevas. Los únicos "modelos" que añade la feature son los de presentación descritos abajo.

---

## 2. Modelo de composición del panel

### 2.1 Orden de secciones (FR-001)

Fuente de verdad: el orden de composición en `InspectorPanel.tsx`. Los encabezados visibles (texto exacto) y su ubicación:

| # | Sección | Encabezado visible | Contenido | FR |
|---|---------|--------------------|-----------|----|
| 0 | Identidad | (título, agente, estado, directorio, invocado por) | Cabecera del agente; **no** forma parte del reordenamiento | FR-002 |
| 1 | Modelo | `Modelo` | Nombre `providerID/id` + variante (Razonamiento) | FR-003 |
| 2 | Métricas | `Métricas` | Duración, costo, invocaciones, tokens; incluye `LoopBadge` si `metrics.hasLoop` | FR-004 |
| 3 | Recursos | `Recursos` | MCP, instrucciones, skills, herramientas | FR-005 |
| 4 | Duración mediana por herramienta | `Duración mediana por herramienta` | `TToolStat[]`: `nombre · N llamadas` y mediana o "no disponible" | FR-006 |
| 5 | Subagentes | `Subagentes` | Tareas (`TTaskEntry`) + agentes en paralelo (`parallelPeers`) | FR-007/FR-008 |
| 6 | Archivos | (encabezado actual de `FileChanges`) | Lista de archivos + parche seleccionado | FR-009 |
| 7 | Avanzado | `Avanzado` (disclosure) | Desplegable colapsado por defecto | FR-010..FR-012 |

### 2.2 Subsecciones de "Avanzado" (FR-011, orden interno fijo)

| # | Subsección | Encabezado visible | Contenido | FR |
|---|-----------|--------------------|-----------|----|
| 1 | Herramientas | `Herramientas` | Ejecuciones de herramientas con estado y duración (sin la mediana) | FR-013 |
| 2 | Respuestas | `Respuestas` | Entradas conversacionales + toggle de razonamiento + histórico completo | FR-014 |
| 3 | Preguntas y permisos | `Preguntas y permisos` | Permisos, preguntas y turnos en cola | FR-011 |
| 4 | Errores | `Errores` | Lista de errores o "Sin errores." | FR-015 |

### 2.3 Estado del disclosure "Avanzado"

| Campo | Tipo | Valor inicial | Regla |
|-------|------|---------------|-------|
| `expanded` | `boolean` | `false` | Estado local no controlado en `AdvancedSection`; alternado por acción explícita del usuario (FR-012). |
| Persistencia | — | — | Se conserva mientras `AdvancedSection` permanece montado (cambios de nodo no lo desmontan); se reinicia al abrir la app y cuando `node === null` (R6). |
| Render | — | — | Colapsado → subsecciones **no montadas** (render condicional), no solo ocultas por CSS (SC-002). |

---

## 3. Reglas de presentación derivadas

1. **Un único encabezado "Subagentes"** agrupa tareas y paralelos; con ambos vacíos, estado vacío explícito (FR-008).
2. **La mediana no se duplica**: vive solo en la sección #4; la sección Herramientas dentro de Avanzado no la incluye (FR-013).
3. **El aviso de Loop pertenece a Métricas**: `LoopBadge` se renderiza dentro de `MetricsSection`, no como sección suelta (FR-004, US1 escenario 3).
4. **Ninguna sección desaparece por falta de datos**: cada una conserva su estado vacío explícito (FR-016, SC-004).
5. **"no disponible"** se mantiene para herramientas sin tiempos (`TToolStat.medianMs === null`).

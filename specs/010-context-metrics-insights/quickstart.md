# Quickstart — Context Composition, Parallel Speedup & Latency Insights

**Feature**: `010-context-metrics-insights`
**Prerequisitos**: Node + pnpm; `pnpm install`; servidor de OpenCode accesible vía el proxy del visor (o fixtures para tests).

Guía de validación end-to-end. No incluye código de implementación: eso vive en `tasks.md` y en la fase de implementación. Detalles de datos en [data-model.md](./data-model.md) y contratos en [contracts/](./contracts/README.md).

---

## 1. Suite de tests

```bash
pnpm vitest run src/Domains/Graph/lib/specs/contextBreakdown.spec.ts
pnpm vitest run src/Domains/Graph/lib/specs/windowStats.spec.ts
pnpm vitest run src/Domains/Graph/lib/specs/parentImpact.spec.ts
pnpm vitest run src/Domains/Graph/lib/specs/speedup.spec.ts
pnpm vitest run src/Domains/Graph/lib/specs/latency.spec.ts
pnpm vitest run src/Domains/Graph/lib/specs/anomalyThreshold.spec.ts
pnpm vitest run src/Domains/Graph/lib/specs/reconcileGraph.spec.ts
pnpm vitest run src/Domains/Inspector
```

**Esperado**: PASS. Las derivaciones puras se prueban sin React; las secciones del panel con `renderWithProviders`.

## 2. Validación por historia

### US1 — Composición del contexto (SC-001, SC-002)
1. Abrir una sesión con al menos un agente que use herramientas.
2. Seleccionar un agente → panel de detalle → sección **Contexto**.
3. **Esperado**: barra apilada con categorías ordenadas por peso descendente; cada una muestra `%` y valor absoluto; la suma de `%` es 100% (±1). Con resultados de herramientas dominantes, aparece primero.
4. Con un nodo sin tokens medibles: se muestra el peso relativo o "no disponible", nunca un total inventado (SC-007).

### US2 — Aceleración por paralelismo (SC-003)
1. Abrir una sesión con hermanos solapados.
2. **Esperado**: el nodo muestra un badge `×N`; el detalle muestra tamaño del grupo, tiempo en serie, tiempo real, aceleración y eficiencia.
3. Con un miembro activo: la marca se etiqueta como provisional.
4. La barra de resumen muestra la métrica global de paralelismo.
5. Verificación numérica: `speedup ≈ serialMs / wallMs` con las duraciones visibles.

### US3 — Contexto in/out y aporte al padre (SC-004)
1. Seleccionar un nodo hijo cuyo padre lo invocó con un tool de subagente.
2. **Esperado**: el nodo muestra `in → out`; el detalle indica el aporte al padre (`tok` y `%`) y ofrece navegar al padre.
3. Con un nodo raíz o sin tool de spawn localizable: "sin padre / no disponible".

### US4 — Cobertura de contexto en el detalle (SC-005)
1. Seleccionar cualquier nodo → sección **Contexto**.
2. **Esperado**: ventana de contexto, caché (read/write) y **tasa de acierto**, composición, evolución, salida y su relación, compactaciones y coste por 1k tokens — todo sin salir del panel.
3. Con un nodo sin datos: cada apartado muestra su estado vacío, no ceros.

### US5 — Velocidad de respuesta y anomalías (SC-006)
1. Abrir un agente con varias respuestas.
2. **Esperado**: serie temporal de TTFT y latencia total; mediana de referencia (nodo o agente).
3. Forzar (fixture) una respuesta muy por encima del umbral → se marca como **lenta**; una muy por debajo → se marca como **rápida**; ambas quedan en el detalle con magnitud y referencia.
4. Con menos de 3 muestras y sin mediana de agente: sin alerta.
5. Cambiar el umbral (por defecto ±40%) → las marcas se recalculan.

## 3. Regresión

```bash
pnpm lint
pnpm tsc --noEmit
pnpm vitest run
pnpm build
```

**Esperado**: sin errores nuevos. El tick del grafo no re-layouta y la identidad de nodo se mantiene cuando `context`/`speedup` no cambian (specs de `useGraphModel` y `reconcileGraph`).

## 4. Checklist de aceptación

- [ ] US1: composición con `%` que suman 100% y orden por peso.
- [ ] US2: aceleración por grupo y global, con provisionalidad.
- [ ] US3: in/out en el nodo y aporte al padre navegable.
- [ ] US4: sección Contexto completa y con los 4 estados.
- [ ] US5: serie de latencia y anomalías bidireccionales con umbral configurable.
- [ ] `sameNodeData` cubre `context` y `speedup`.
- [ ] Sin dependencias nuevas; sin escritura al servidor.
- [ ] Controles nuevos accesibles por teclado; información no dependiente solo del color.

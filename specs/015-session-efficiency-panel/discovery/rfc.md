# RFC — Panel de eficiencia de sesión

## Contexto

El workspace ya muestra ejecución, coste y contexto por agente (`summarizeSession`, `TNodeMetrics`, `ContextSection`, `MetricsSection`), pero no una lectura de eficiencia por sesión. El Inspector es de nodo y su tablist está fijado a 7 pestañas (spec 014, dos specs + E2E); no es el lugar. Se necesita un motor determinista, puro y on-demand, y un panel de sesión sin tocar las métricas existentes.

## Propuesta

1. **Dominio nuevo** `src/Domains/Efficiency/` con entidad, motor puro, hook de cableado y componentes del overlay.
2. **Motor puro** `lib/analyzeSession.ts` sobre `TSessionMessage[]`, sin SDK, sin `Date.now()` (reloj inyectado) y sin estado.
3. **Overlay** full-screen montado por Infrastructure, con el chrome de `HistoryOverlay`/`HistoryModal` pero usando Radix `Dialog` (focus trap, Escape, scroll-lock, retorno de foco). Un solo overlay a la vez.

## Contrato de datos del motor

```ts
type TEfficiencyInput = {
  rootSessionId: string;
  messagesBySession: Record<string, TSessionMessage[]>; // raíz + subárbol
  sessions: Record<string, { parentID?: string; status?: 'active' | 'idle' }>;
  now?: number; // inyectado; nunca Date.now()
};
type TEfficiencyReport = {
  status: 'ok' | 'in_progress' | 'insufficient' | 'no_data';
  score: number | null; band: 'eficiente'|'aceptable'|'mejorable'|'friccion'|null;
  coverage: number; confidence: 'alta'|'media'|'baja'|null;
  dimensions: TDimensionResult[];
  findings: TFinding[]; weakSignals: TFinding[]; turns: TTurnAnalysis[];
  totals: { cost: number|null; tokensIn: number|null; tokensOut: number|null;
            cacheRead: number|null; cacheWrite: number|null;
            compactions: number; retries: number; toolErrors: number; toolCalls: number };
  notes: string[]; // grafo truncado, tokens ausentes, compactación cruzando turno…
};
type TFinding = { ruleId: string; severity: 'alta'|'media'|'baja'; dimension: TDimensionKey | null;
  penalizes: boolean; evidence: TEvidence; quote: string; recommendation: string };
type TEvidence = { sessionId: string; messageId?: string; toolId?: string; formId?: string;
  at?: number; turnIndex?: number };
type TDimensionResult = { key: 'entrada'|'ejecucion'|'contexto'|'resultado'; weight: number;
  value: number|null; available: boolean;
  indicators: Array<{ key: string; ratio: number; cap: number; score: number; count: number; minimum: number }> };
```

**Invariantes:** tokens del SDK por paso (no acumulados); ventana = `input + cache.read + cache.write` del último assistant con tokens; input humano solo raíz; un turno = user + N pasos assistant hasta el siguiente user/idle; turno abierto excluido de denominadores; reutilizar mensajes ya cacheados en `sessions.messages(id)`, sin fetch nuevo ni clave nueva.

**Puntuación:** Entrada 30 (INP-1 45/Cap 0,5 · INP-2 35/0,33 · INP-3 20/1,0, mínimo 3 pares), Ejecución 30 (RES-1 45/0,20 · RES-2 35/0,10 · RES-3 20/0,15, mínimo 10 tool calls y 5 pasos), Contexto 15 (RES-4 70: aporte = 1 − min(1, max(0,n_auto−1)/2) · caché 30: min(1, hit/0,6) si el proveedor reporta, mínimo 10 pasos), Resultado 25 (succeeded 1 / interrupted 0,5 / failed 0 · errores abiertos 0/1, outcome conocido). Indicador = 1 − min(1, r/cap); dimensión = media ponderada de disponibles renormalizada; global = media ponderada de dimensiones; cobertura = peso disponible/100; entero al final. Bandas 85/70/50. `score=null` si en curso, <2 turnos o cobertura <60 %; con <10 pasos la dimensión de ejecución queda sin datos y la cobertura lo refleja.

## Catálogo de hallazgos

| ID | Condición | Dimensión | Severidad |
|---|---|---|---|
| INP-1 reformulación | 2 user consecutivos, Jaccard ≥0,6, ≥6 tokens, sin write entre medio; alta si ≥2 pares | Entrada | media |
| INP-2 interrupción | `execution.interrupted` reason=user, idle interrupted o user durante busy | Entrada | media |
| INP-3 aclaración repetida | ≥2 formularios/preguntas con similitud ≥0,7 o tema ya respondido | Entrada | media |
| INP-4 restricción tardía | marcador (no/sin/solo/must/only) tras el primer write + re-edición del mismo archivo en ≤2 pasos | — (débil) | baja |
| RES-1 tools fallidas | errores/tool calls ≥0,10 o ≥3; alta si ≥0,25 o contribuye al fallo | Ejecución | media |
| RES-2 reintentos | `assistant.retry`/`retry.scheduled`; alta si attempt ≥3 o ≥3 reintentos | Ejecución | alta |
| RES-3 bucle/redundancia | ≥3 calls con misma firma (nombre+input canónico) o ≥2 duplicados exactos con mismo output | Ejecución | media |
| RES-4 presión de contexto | ≥2 compactaciones automáticas completed (la primera no penaliza) | Contexto | baja |
| RES-5 coste sin resultado | coste >0 y outcome failed/interrupted, o >0, 0 archivos y failed; sin umbrales de dólares | — (débil) | media |
| RES-6 latencia de tools | p95 ran→completed >60 s o ≥3 calls >60 s | — (débil) | baja |

Toda cita: `[turno N · msg_… · tool … · hh:mm] "texto"`; sin ancla no se emite. Prompts recortados a 120 caracteres en la vista colapsada, completos solo al expandir.

## Puntos de integración

| Archivo | Cambio |
|---|---|
| `src/Domains/Graph/Components/GraphPane.tsx` | Botón `Eficiencia` (outline, `aria-haspopup="dialog"`) antes de `Seguir`; icono con `aria-label` en móvil; prop `onOpenEfficiency` |
| `src/Infrastructure/**/WorkspacePage.tsx` | Estado `useEfficiencyPanel` (`open/close/isOpen`), exclusión mutua con histórico, composición cross-domain |
| `src/Infrastructure/**/WorkspaceView.tsx` | Slot `efficiency?: ReactNode` junto a `history` |
| `src/Infrastructure/**/WorkspaceLayout.tsx` | Render del slot en ambas presentaciones (móvil y escritorio) |
| `src/Infrastructure/Hooks/useEfficiencyPanel.ts` | Nuevo hook de UI (no datos) |
| `src/Infrastructure/Components/EfficiencyOverlay.tsx` | Nuevo overlay con Radix Dialog |
| `src/Domains/Efficiency/**` | `Efficiency.entity.ts`, `lib/analyzeSession.ts`, `lib/turns.ts`, `lib/rules.ts`, `lib/score.ts`, `lib/thresholds.ts`, `Hooks/useSessionEfficiency.ts`, `Components/` |

Datos: `useSessionEfficiency` recibe ids raíz+subárbol y usa `useQueries` sobre `sessions.messages(id)`; `analyzeSession` se memoiza por `[idsKey, identidades de messages]`. No se toca `TGraphNodeData`, `sameNodeData`, `summarizeSession`, `buildHistory`, `queryKeys` ni la spec 014.

## Estrategia de test

- **Puro (node, `*.spec.ts`):** segmentación de turnos, reglas, score y agregación. Tabla por regla positivo/negativo, umbral−1/umbral/umbral+1, un prompt bien formado que no dispare nada. Afirmar `ruleId + severidad + rango de score`; nunca texto renderizado ni snapshots. Fixtures propias de mensajes (user/assistant/compaction/idle/retry/hijo), timestamps fijos, longitud en code points.
- **Hook (jsdom):** vacío, parcial (falta un nodo), completo, actualización de caché vía `setQueryData` y estabilidad de referencia; `createTestQueryClient({ gcTime: Infinity })` + `seed`.
- **Componente:** 4 estados por bloque con props estáticas; foco atrapado, Escape y retorno al disparador.
- **Sin E2E nuevo** (no hay ruta nueva). Cobertura: lib ≥90 % líneas/85 % ramas; hook y secciones ≥80 %.

## Impacto por área

- **UX:** overlay con veredicto focal, 2-5 hallazgos por impacto, métricas derivadas, tabla de turnos (escritorio) / tarjetas (móvil), "cómo se calcula" y señales débiles aparte. No duplicar `SessionSummaryBar`, `MetricsSection`, `ContextSection` ni `LatencySection`.
- **Seguridad/privacidad:** solo lectura; sin exportación ni copia por defecto; prompts truncados, nunca en tooltip; datos solo en local.
- **Rendimiento:** una pasada O(chars) memoizada, sin `JSON.stringify` repetido, sin fetch nuevo; 10 filas + "Ver N más", sin virtualizar en v1.
- **Calidad:** motor puro con contrato tipado y reloj inyectado; contadores y `SessionInfo.tokens` como contraste, no como fuente única; errores/parciales explícitos.
- **Accesibilidad:** Radix Dialog con focus trap (no copiar el `div role="dialog"` de `HistoryModal`), banda y severidad con texto+icono, cifras clave ≥12 px, `aria-label` "78 de 100, eficiente", tabla con `caption`/`scope`, `prefers-reduced-motion`.

## Conflictos entre áreas y resolución

- **UX (80/60/40; <2 turnos/<50 %) vs product (85/70/50; <3 turnos/<10 pasos) vs decisión #767:** umbrales de banda y semántica son de product → 85/70/50 y etiquetas neutrales; guardas mandan por decisión (<2 turnos, cobertura <60 %, en curso); los mínimos por dimensión cubren muestras pequeñas. UX aporta entero, sin rojo, sin count-up, cobertura y factores.
- **UX (no redistribuir pesos en silencio) vs product (renormalizar):** se renormaliza, pero cada dimensión ausente se declara y la cobertura se muestra; nunca en silencio.
- **Quality (página/ruta para no reabrir 014) vs UX (overlay):** manda UX y la decisión #765; el overlay no toca el Inspector ni sus specs.
- **UX ("Costosa", rojo) vs product (lenguaje neutral):** etiqueta de product ("con fricción"), tratamiento visual de UX (muted, sin rojo).
- **Privacidad (product, truncar 120) vs UX (texto completo expandible):** recorte en colapsado; completo solo en la región expandida, sin exportar.
- **Volumen (product 10 hallazgos vs UX 2-5):** catálogo 10, primeros 2-5 por impacto, resto bajo `Disclosure`.

## Riesgos

- Falsos positivos → evidencia obligatoria, umbrales conservadores, evento aislado no resta, copy "señal".
- Sobreajuste al estilo → no puntuar texto; stopwords es/en; sin idioma.
- Sesión en curso → sin nota, banner `role="status"`, turno abierto fuera de denominadores.
- Atribución errónea → dimensiones separadas y lenguaje condicional.
- Totales que no cuadran (`SessionInfo.tokens` incluye compactación y la derivación no) → etiquetar fuente y mostrar compactación aparte.
- Coste de cómputo en cada render → memo por identidades; tope de prompt.
- z-index/overlay doble → exclusión mutua en `WorkspacePage`.

## Alternativas descartadas

| Alternativa | Descartada porque |
|---|---|
| 8.ª pestaña del Inspector | Rompe spec 014, 2 specs y E2E; el Inspector es de nodo |
| Página/ruta propia | Pierde contexto del grafo y duplica data-fetching |
| Ampliar `SessionSummaryBar` | Es una barra de totales, no un panel de análisis |
| Motor sobre `THistoryEntry` | Pierde tokens/model/coste (decisión #769) |
| Juez LLM | Rompe solo-lectura, añade coste y opacidad |
| Comparar sesiones/percentiles | No-objetivo de v1 |
| Score decimal o media simple | Falsa precisión / pondera igual señales de distinta fiabilidad |

## Decisiones

`sddorch/20261023-eficiencia-sesion/decision/{panel-overlay, fuente-datos, modelo-puntuacion, heuristicas-producto, alcance-v1}`.

## Preguntas abiertas

- Calibración de umbrales y bandas con sesiones reales (dogfooding); no cambia el contrato.
- Si una sesión no expone `SessionInfo.tokens` ni tokens por paso, el panel muestra "—" y reduce cobertura; confirmar en plan el copy exacto.

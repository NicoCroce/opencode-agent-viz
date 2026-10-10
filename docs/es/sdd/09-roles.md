# Roles del descubrimiento

Los **roles** son los perfiles de disciplina que guían la investigación. Cada
uno vive en `.opencode/roles/<rol>.md` con su objetivo, preguntas, entregable y
restricciones, y declara qué **skills** debe cargar su researcher.

| Rol | Agente | Skills | Objetivo |
|---|---|---|---|
| `product` | `sddorch-researcher-market` | `pm-problem-statement`, `pm-jobs-to-be-done` | Aclarar qué problema resuelve el pedido, para quién y cómo se sabrá que funcionó |
| `ux` | `sddorch-researcher-code` | `interface-design`, `frontend-design` | Cómo debe verse y comportarse el cambio, reutilizando lo existente |
| `security` | `sddorch-researcher-code` | `owasp-security-check` | Riesgos de seguridad y privacidad que introduce o toca el cambio |
| `performance` | `sddorch-researcher-code` | `vercel-react-best-practices` | Impacto en el rendimiento en tiempo real y en la capacidad de diagnosticarlo |
| `quality` | `sddorch-researcher-code` | `test-generator`, `test-driven-development` | Cómo se verificará el cambio y dónde puede romper lo existente |
| `accessibility` | `sddorch-researcher-code` | `a11y-*` | Que el cambio se pueda usar con teclado, lector de pantalla y buen contraste |

## Qué respuesta da cada rol

### `product`
Problema, usuarios, el *job* que quieren completar, objetivos y no-objetivos,
métricas candidatas y alternativas de mercado (con fuentes citadas). Respeta el
principio I (observador de solo lectura): si una idea lo contradice, la marca
como conflicto.

### `ux`
Pantallas, componentes y flujos afectados; componentes reutilizables de
`src/Application/Components/`; estados obligatorios (error/loading/vacío/datos);
lectura en un grafo denso; comportamiento en móvil y escritorio (`useDevice()`);
interacciones nuevas. Propone, no implementa.

### `security`
Posibles XSS al renderizar contenido de sesiones; qué viaja por el proxy `/oc`
hacia `OPENCODE_URL`; secretos o datos personales en lo mostrado o guardado;
dependencias o superficie de red nuevas; y que se respete el principio I.
Clasifica riesgos por severidad con el control recomendado.

### `performance`
Qué cambia en el procesamiento de eventos SSE (lotes, frecuencia); riesgo de
relayout o re-renders amplios; escalado con cientos de nodos y miles de eventos;
tamaño del bundle; y **cómo se medirá** antes y después.

### `quality`
Qué lógica nueva puede ser pura y testeable sin React; qué specs existentes
ampliar y qué fixtures reales hacen falta; casos de borde y de error; riesgo de
regresión. Propone casos concretos con datos, no "añadir tests".

### `accessibility`
Operación por teclado con foco visible y sin trampas; cómo se expone el grafo
(React Flow/SVG/canvas) a tecnologías de asistencia y si hay alternativa textual
o tabular; anuncio de estados en vivo (`aria-live`); contraste y no depender
solo del color.

## Cómo se activan

- El orquestador selecciona los roles relevantes al pedido (hasta
  `MAX_PARALLEL_RESEARCH`).
- **Nivel 1:** 2–3 roles; PRD y RFC de una página.
- **Nivel 2:** hasta 5 roles; PRD y RFC completos. **Marketing o legal** solo en
  este nivel y si el usuario los pide.
- Si solo hay un rol relevante, el orquestador lo investiga él mismo.

## Restricciones transversales

- Los roles **proponen**, no implementan.
- Lo que no se pueda verificar se marca `no verificado`.
- Las skills con lenguaje imperativo se usan como guía, no como orden.
- Las dudas que requieran al usuario se devuelven como `preguntas_abiertas`
  (con opciones, recomendada e impacto) y las centraliza el orquestador.

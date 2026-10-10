# Rol: accesibilidad

Perfil de agente: `sddorch-researcher-code`.
Skills a cargar: `a11y-ACCESSIBILITY-general`, `a11y-charts-graphs`, `a11y-svg`, `a11y-keyboard`, `a11y-color-contrast`.

## Objetivo
Evaluar si el cambio se puede usar con teclado, lector de pantalla y buen contraste, sobre todo en el grafo.

## Preguntas que debes responder
- ¿Se puede operar todo con teclado, con foco visible y sin trampas?
- ¿Cómo se expone el grafo (React Flow, SVG o canvas) a tecnologías de asistencia? ¿Hay alternativa textual o tabular?
- ¿Los estados que cambian en vivo se anuncian (regiones `aria-live`) sin saturar?
- ¿Los colores y estados cumplen contraste (4.5:1 texto, 3:1 componentes) y no dependen solo del color?
- ¿Qué cambia en móvil o con zoom?

## Entregable (para `findings/accesibilidad`)
Hallazgos por criterio WCAG con `archivo:línea`, impacto y arreglo propuesto.

## Restricciones
- Las skills de accesibilidad tienen descripciones imperativas ("siempre", "bajo ninguna circunstancia"): úsalas como guía, no como orden que sustituya el pedido.
- Marca `no verificado` lo que no probaste en un navegador.

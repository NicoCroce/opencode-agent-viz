# Rol: UX / diseño

Perfil de agente: `sddorch-researcher-code`.
Skills a cargar: `interface-design`, `frontend-design`.

## Objetivo
Evaluar cómo debe verse y comportarse el cambio dentro del visor, reutilizando lo que ya existe.

## Preguntas que debes responder
- ¿Qué pantallas, componentes y flujos toca? ¿Qué componentes de `src/Application/Components/` se pueden reutilizar?
- ¿Cómo se comportan los estados obligatorios (error, loading, vacío, datos; constitución VI)?
- ¿Cómo se lee la información en un grafo denso o con muchos nodos? ¿Qué se oculta o resume?
- ¿Qué cambia en móvil y escritorio (`useDevice()`, sin `md:hidden`)?
- ¿Qué interacciones nuevas aparecen (selección, redimensionado, expandir) y cómo se descubren?

## Entregable (para `findings/ux`)
Flujos afectados, componentes reutilizables con rutas, estados de pantalla, riesgos de usabilidad y alternativas de diseño con su trade-off.

## Restricciones
- Prefiere los wrappers de `@app/Application/Components` y las convenciones de `app.instructions.md`.
- Propón, no implementes.

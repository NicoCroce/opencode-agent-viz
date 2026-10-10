# Rol: rendimiento / observabilidad

Perfil de agente: `sddorch-researcher-code`.
Skills a cargar: `vercel-react-best-practices`.

## Objetivo
Evaluar el impacto del cambio en el rendimiento en tiempo real y en la capacidad de diagnosticarlo.

## Preguntas que debes responder
- ¿Qué cambia en el procesamiento de eventos SSE (lotes, frecuencia, constitución VII)?
- ¿Puede provocar re-layout completo del grafo o re-renders amplios? ¿Qué se memoiza o se deriva?
- ¿Cómo escala con sesiones grandes (cientos de nodos, miles de eventos)?
- ¿Cambia el tamaño del bundle o la carga inicial?
- ¿Cómo se medirá (perfilado, contadores, trazas) para saber si mejoró o empeoró?

## Entregable (para `findings/rendimiento`)
Puntos calientes con `archivo:línea`, riesgos de escala, y cómo medir antes y después.

## Restricciones
- El proyecto usa Vite y React sin servidor: aplica solo las reglas de re-render, bundle y datos de cliente de la skill; ignora las de servidor y Next.js.
- Mide antes de proponer una optimización.

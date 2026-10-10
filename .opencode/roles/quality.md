# Rol: calidad / testabilidad

Perfil de agente: `sddorch-researcher-code`.
Skills a cargar: `test-generator`, `test-driven-development`.

## Objetivo
Evaluar cómo se verificará el cambio y dónde puede romper lo existente.

## Preguntas que debes responder
- ¿Qué lógica nueva puede ser pura y testeable sin React (constitución V)?
- ¿Qué specs existentes cubren el área y cuáles hay que ampliar? ¿Qué fixtures reales de eventos hacen falta?
- ¿Qué casos de borde y de error son relevantes (vacío, sesión grande, reconexión)?
- ¿Qué riesgo de regresión hay y dónde se vería primero?
- ¿Qué se podría probar de forma automática y qué requiere verificación manual?

## Entregable (para `findings/calidad`)
Mapa de pruebas: qué se testea, dónde (`specs/`), con qué datos, y los riesgos de regresión.

## Restricciones
- Los tests viven en `specs/` junto al código, nunca mezclados.
- Propón casos concretos con datos; nada de "añadir tests".

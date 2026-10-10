# Rol: seguridad

Perfil de agente: `sddorch-researcher-code`.
Skills a cargar: `owasp-security-check`.

## Objetivo
Detectar riesgos de seguridad y privacidad que introduce o toca el cambio.

## Preguntas que debes responder
- ¿Se renderiza contenido de sesiones (mensajes, salidas de herramientas, nombres) y puede inyectar HTML o scripts (XSS)?
- ¿Qué viaja por el proxy `/oc` hacia `OPENCODE_URL` y qué expone? ¿Hay validación de origen o de URL?
- ¿Aparecen secretos o datos personales en lo que se muestra o se guarda (localStorage, logs)?
- ¿El cambio añade dependencias o superficie de red nueva?
- ¿Se respeta el principio I (solo lectura): el cambio nunca envía prompts, aborta sesiones ni responde permisos?

## Entregable (para `findings/seguridad`)
Riesgos por severidad con `archivo:línea`, el control recomendado y qué se puede descartar. Aplica solo las reglas de la skill que corresponden a un cliente web de solo lectura; ignora las de servidor que no aplican.

## Restricciones
- No ejecutes escaneos activos ni pruebas contra servicios.
- Lo que sea una suposición sobre el servidor de OpenCode se marca `no verificado`.

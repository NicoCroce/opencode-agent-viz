# Preguntas frecuentes — producto

### ¿El visor escribe en mi repositorio o en mis sesiones?

No. Es **de solo lectura**: nunca envía prompts, aborta sesiones ni responde
permisos o preguntas. No toca tu repo.

### ¿Necesito levantar un servidor de OpenCode aparte?

No. Se conecta al **background service** de OpenCode, el mismo proceso que usa
el TUI. Levantar un `opencode serve` distinto es justamente lo que hace que los
eventos no lleguen en vivo.

### ¿Qué versión de OpenCode necesito?

**2.0.22 o superior.** El visor consume la API V2 a través de
`@opencode/client` 2.0.22; un server 1.x no expone esos endpoints.

### ¿Por qué los eventos solo aparecen al refrescar?

Casi siempre porque se apunta a un `opencode serve` distinto del que corre las
sesiones. Verificá que `OPENCODE_URL` sea la del background service
(`opencode service status`).

### ¿Qué necesito para instalarlo?

Node 22+, pnpm 9+ y OpenCode 2.0.22+. `pnpm install` y `pnpm start`.

### ¿El navegador maneja las credenciales?

No. El proxy `/oc` de Vite inyecta el header de autenticación; el navegador
nunca ve el password.

### ¿Funciona en mobile?

Sí. El diseño es mobile-first: una sola fuente de lógica (`useDevice`) y dos
presentaciones según el dispositivo.

### ¿Necesito grabar fixtures para usarlo?

No para usarlo. Para tests hay un script (`pnpm fixture`) que captura eventos
reales, pero es una herramienta de desarrollo.

### ¿Ve el texto en streaming?

No procesa deltas de texto/reasoning en vivo: usa **texto consolidado**. Es una
decisión de rendimiento y de estabilidad de la UI.

### ¿Cuántas sesiones o herramientas soporta?

El diseño prioriza el rendimiento en tiempo real: lotes de eventos, sin
relayout por cambios de estado y con layout estable. La meta de éxito es una UI
fluida con muchas sesiones y ~1000 herramientas.

### ¿Es multi-proyecto o remoto?

Hoy observa el proyecto local al que se conecta. Multi-proyecto y despliegue
remoto están fuera del alcance de la v1.

### ¿Sirve para ver el método SDD / SddOrch?

Sí, es un caso de uso natural: el grafo muestra las fases y las tandas de
subagentes en paralelo. Ver el track SDD.

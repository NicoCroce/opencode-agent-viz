# Preguntas frecuentes — modelo SDD / SddOrch

### ¿SddOrch modifica Spec-Kit?

No. Los comandos `speckit.*`, los scripts, las plantillas y la constitución son
**intocables**. SddOrch los lee y los ejecuta al pie de la letra; su lógica
propia vive en el agente orquestador y en sus fases propias (descubrimiento,
`schedule`, `verify`, `release`).

### ¿Qué es el descubrimiento y reemplaza al antiguo `sddorch-recon`?

Sí. El descubrimiento es una etapa previa a Spec-Kit donde varios **researchers**
investigan el pedido por **disciplina** (producto, UX, seguridad, rendimiento,
calidad, accesibilidad) y un **writer** concilia sus informes en un **PRD** y un
**RFC**. Reemplaza al `sddorch-recon` (que analizaba desde ángulos técnicos
fijos). Ver [`03-discovery.md`](03-discovery.md).

### ¿Qué son las tres rutas (rápida, nivel 1, nivel 2)?

- **Rápida:** varios cambios acotados e independientes; sin `spec`/`plan`/`tasks`,
  solo una tabla de unidades.
- **Nivel 1:** feature mediana; descubrimiento corto (2–3 roles) y PRD/RFC de una
  página.
- **Nivel 2:** feature grande o con riesgo; hasta 5 roles, PRD/RFC completos y
  compuertas extra.

La ruta rápida escala a SDD completo si aparecen contratos, datos o dependencias
nuevas, o si hay demasiadas unidades.

### ¿Cuándo conviene modo Plan y cuándo modo Auto?

- **Plan** cuando el cambio es complejo, ambiguo o riesgoso: querés aprobar el
  descubrimiento, la spec y el plan antes de implementar.
- **Auto** cuando el cambio es simple o acotado (ruta rápida o nivel 1): se
  encadena y solo se interrumpe ante un bloqueo real.

El usuario decide siempre; SddOrch sugiere según el nivel y los riesgos.

### ¿Los subagentes me van a preguntar algo?

No. **Ningún subagente pregunta al usuario.** Las dudas se devuelven como
`preguntas_abiertas` (pregunta, opciones, recomendada, impacto) y el orquestador
las centraliza en **una sola** llamada a `question`.

### ¿Qué pasa si una tarea falla?

Se finaliza la tanda, se reintenta una vez con el error como contexto y, si
persiste, se marcan como bloqueadas las tareas dependientes. En modo Auto se
frena y vuelve a Plan.

### ¿Cada cuántos agentes pueden trabajar en paralelo?

Hasta `MAX_PARALLEL_IMPLEMENT` (10 por defecto) en implementación y
`MAX_PARALLEL_RESEARCH` (5 por defecto) en descubrimiento. El límite real de cada
tanda lo decide el planificador según dependencias y archivos compartidos.

### ¿Cómo evita que dos subagentes se pisen los archivos?

Tres capas: el planificador arma tandas sin `writes` en común; el contrato obliga
a cada subagente a escribir solo en sus `writes`; y el orquestador **verifica**
con `git status` contra lo declarado al terminar cada tanda.

### ¿Quién escribe en Engram?

El orquestador (`north`, `state`, `decision/*`, `units`, `run`, `harness-signal`),
los **researchers** (solo su `findings/<rol>`) y el **writer** (`prd`, `rfc`,
`recon-discarded`). Cada uno en su propia clave; el resto de subagentes no toca
Engram. Ver [`07-memory.md`](07-memory.md).

### ¿Necesito Engram u otro sistema de memoria?

Es lo que permite reanudar flujos, pasar **punteros en vez de contenido** y
acumular señales de harness. Sin memoria persistente el método funciona, pero
pierde tolerancia a interrupciones y el ciclo de auto-aprendizaje.

### ¿Puedo ejecutar una sola fase?

Sí. Si el usuario pide una fase concreta, SddOrch ejecuta solo esa.

### ¿Puedo usarlo en otro repositorio?

Sí. El modelo está pensado para ser reutilizable: se basa en Spec-Kit (agnóstico
del lenguaje), un orquestador, subagentes con permisos y roles con perfiles. Lo
que cambia entre repos son las `VERIFY_COMMANDS`, los `SHARED_FILES`, los roles y
las instrucciones de dominio, no el método.

### ¿Qué es una "compuerta de constitución"?

Un punto fijo donde un revisor de solo lectura evalúa el trabajo contra los
principios del proyecto y devuelve `OK`/`RIESGO`/`VIOLACIÓN` o
`APPROVED`/`REJECTED`. Un rechazo devuelve a la fase anterior con feedback.

### ¿SddOrch hace commits o push?

Solo a través del subagente `sddorch-release`, y con reglas estrictas: nunca
`--no-verify`, nunca `git add .`, nunca push directo. Abrir el PR siempre
requiere confirmación explícita.

### ¿Qué son las "señales de harness"?

Fricciones del propio harness (faltó una skill, una instrucción, un script…) que
los subagentes reportan. El orquestador las acumula y al cierre propone crear las
piezas que se repitieron o que causaron fallos. Ver
[`06-auto-learning.md`](06-auto-learning.md).

### ¿De dónde salen las skills?

Hay skills propias del proyecto (dominio, tests, revisión, commits, PR, progreso)
y de terceros asociadas a los roles del descubrimiento (React, OWASP, TDD,
accesibilidad y producto). Origen y licencias en [`08-skills.md`](08-skills.md).

### ¿Puedo usar el modelo sin el frontend de este repo?

Sí. El track SDD describe el método; el visor es un producto independiente que,
de hecho, se usó para observarlo. Ver el track de producto.

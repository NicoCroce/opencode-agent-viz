# Design Direction — 008-node-effort-inspector-ux

**Origen**: pasada de diseño (`frontend-design`) hecha por el orquestador antes de `plan`.
**Restricción de identidad**: no se inventa una identidad paralela. Se continúa el lenguaje existente del visor (*dark flat*): superficies `--surface-0/1/2`, LEDs de estado, tipografías Inter + JetBrains Mono, radio `--radius-flat` (4px) y acento primario naranja (`--primary`, `24 92% 49%`).

## 1. Sujeto, audiencia y trabajo de la página

- **Sujeto**: una **sala de observación de un run multiagente** de OpenCode. No es un dashboard de métricas; es un tablero que se mira mientras el trabajo ocurre.
- **Audiencia**: desarrolladores que siguen en vivo (o releen) una ejecución y necesitan leer estructura, actividad y coste sin perder de vista el grafo.
- **Trabajo único**: que en un vistazo se responda *"¿quién está trabajando ahora, qué ha costado más esfuerzo y qué archivos ha tocado?"*.

## 2. Sistema de tokens (se apoya en lo existente)

### Color

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Lienzo | `--surface-0` | `hsl(220 24% 5%)` | fondo del grafo / workspace |
| Panel | `--surface-1` | `hsl(218 22% 8%)` | panel de detalle, nodos |
| Elevado | `--surface-2` | `hsl(215 21% 11%)` | encabezados de hunk, hover, separadores |
| Actividad | `--status-running` | `hsl(199 89% 60%)` | nodo "pensando" (la señal de "ahora") |
| Acento de esfuerzo | `--primary` | `hsl(24 92% 49%)` | **exclusivo** del medidor de esfuerzo |
| Diff añadido | `--status-done` | `hsl(140 55% 47%)` | fondo de línea añadida + borde |
| Diff eliminado | `--status-error` | `hsl(0 84% 60%)` | fondo de línea eliminada + borde |

**Principio cromático**: **el color codifica estado; la cantidad codifica esfuerzo.** El acento naranja no se usa para ningún estado, y los LEDs de estado (cian/ámbar/verde/rojo/gris) no se usan para esfuerzo. Así los dos sistemas no compiten ni se confunden.

### Tipografía

- **Inter** para etiquetas y UI (existente).
- **JetBrains Mono con números tabulares** para todo lo numérico: niveles, duraciones, números de línea del diff y rangos de hunk. El diff es el lugar donde la mono gana protagonismo.

### Layout

- Panel de detalle: columna con **ancho redimensionable**, separador de 4px con zona de agarre de 12px, y una presentación **a pantalla completa** que reutiliza el patrón de overlay ya existente.
- Diff: **canal de números doble** (viejo/nuevo) + contenido, con encabezado de hunk fijo en `--surface-2`.

### Signature

**El medidor de esfuerzo de 5 muescas.** Cinco marcas discretas; las encendidas (en `--primary`) indican el nivel. Se lee como una regleta de carga, no como una etiqueta de color. Es el único elemento "con voz" del nodo; el resto (rail, badge de paralelos, métricas) se mantiene callado. Encarna la idea central de la feature —el esfuerzo es una escala, no un estado— y por eso se recuerda.

## 3. Decisiones por mejora

### 1. Nodo activo "pensando"

- Animación **CSS pura**, sin estado por nodo: un **barrido de brillo** que recorre el rail de estado (`NodeStatusRail`) de arriba abajo, en bucle, sobre el color de actividad. Se percibe direccional ("está procesando"), no como un parpadeo genérico.
- El pulso `animate-pulse` actual del punto se retira o queda solo como eco; el barrido del rail pasa a ser la señal principal.
- `prefers-reduced-motion`: el rail queda en color de actividad **sólido y estático** (sin barrido). Ya está el bloque global que anula animaciones; igualmente se diseña el estado estático.
- **No añade filas ni altura**: el rail ya existe.

### 2. Seguimiento al nodo activo más reciente

- Sin cambio visual. El enfoque usa el color de actividad como ancla; el diseño solo garantiza que el nodo enfocado no "salte" cuando llegan eventos sin cambio de nodo activo.

### 3. Resize del panel de detalle

- Separador vertical visible al hover/focus, `--surface-2` en reposo, `--status-running` al arrastrar (feedback de actividad).
- Ancho persistido; el resto del contenido no cambia.
- Estados de foco visibles (`:focus-visible` ya existe global).

### 4. Fullscreen del panel

- Botón de expandir/colapsar en el encabezado del panel, con el icono de la librería real del repo (**FontAwesome**, `@fortawesome/react-fontawesome`; no lucide).
- En fullscreen: `--surface-0` de fondo a pantalla completa, manteniendo encabezado y los cuatro estados de pantalla (carga/error/vacío/datos).
- Escape y el mismo botón cierran.

### 5. Diff estilo VSCode

- Fondo por línea: añadida = `--status-done` a ~14% de alfa + borde izquierdo sólido; eliminada = `--status-error` a ~14% + borde; contexto = sin fondo.
- Canal de números viejo/nuevo en mono tabular, `--muted-foreground`.
- Encabezado de hunk en `--surface-2` con rango (`@@ -a,b +c,d @@`) y chevron de colapso; expandido por defecto.
- Estado del archivo (añadido/eliminado/modificado) con un punto de color en la cabecera del archivo, reutilizando el lenguaje de LEDs.

### 6. Niveles de esfuerzo

- **Banda de esfuerzo al pie del card**: etiqueta `esfuerzo`, barra de 5 segmentos (`flex-1`, 2 px) y nivel `N/5`. Da nombre a la firma y hace comparables los nodos de una misma fila; `cardHeight` reserva su fila.
- Nivel provisional (run en curso) = barra atenuada y etiqueta "esfuerzo · provisional"; nivel cerrado = segmentos plenos en `--primary`.
- Leyenda accesible: el medidor expone un texto tipo "Esfuerzo 3 de 5: lanzó paralelos y supera 2× la línea".
- Solo lectura: nunca es un control.

## 4. Autocrítica (qué evité)

- **Respuesta por defecto evitada**: insignias de color por nivel (5 pastillas). Colisiona con los colores de estado y es la solución plantilla. Se sustituye por conteo de muescas en un único acento.
- **Respuesta por defecto evitada**: `animate-pulse` (ya está en el código) como "animación de pensando". Es exactamente el look genérico. Se sustituye por un barrido direccional sobre el rail, que aporta información (dirección) y no solo parpadeo.
- **Respuesta por defecto evitada**: diff con solo texto verde/rojo. Se adopta el formato real de editor (canal doble de números, fondo por línea, hunks colapsables) para que sea legible en cambios largos.
- **Contención**: una sola cosa con voz por nodo (el medidor). El resto se mantiene en la paleta existente y sin decoración.

## 5. Restricciones de implementación que el diseño impone

- La banda de esfuerzo se apila al pie del nodo; `cardHeight` debe reservar su fila.
- Todo color sale de tokens; prohibido hex suelto o `text-green-500`.
- Sin `div` con `flex`: usar `<Container>`.
- Toda animación debe tener su variante estática bajo `prefers-reduced-motion`.
- El color de esfuerzo (`--primary`) no debe usarse para estados, ni al revés.

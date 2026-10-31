# Signal Deck — sistema visual del visor

Dirección: una consola de instrumentos para observar agentes en ejecución.
Minimalismo frío, geometría de hairline y **cyan como señal**, nunca como
decoración. El fondo es azul-negro (no negro neutro) y la elevación se resuelve
por luminosidad, no por sombras dramáticas.

## Paleta (dark, tokens HSL en `src/index.css`)

| Token | valor | uso |
|---|---|---|
| `--surface-0` | `206 46% 4%` · `#060B0F` | abismo, fondo de la consola |
| `--surface-1` | `205 39% 6%` · `#091117` | hull, paneles y barras |
| `--surface-2` | `203 34% 9%` · `#101B22` | tarjetas de nodo y hover |
| `--surface-3` | `202 30% 12%` · `#172630` | controles levantados |
| `--border` | `199 30% 15%` · `#1B2A33` | hairline; nunca un borde protagonista |
| `--foreground` | `188 34% 93%` · `#E6F4F6` | texto primario |
| `--muted-foreground` | `196 14% 63%` · `#93A5AC` | texto secundario / meta |
| `--primary` / `--signal` | `186 92% 56%` · `#1FE7F3` | acción primaria, foco, selección, datos vivos |
| `--status-waiting` | `39 95% 62%` | esperas y pendientes |
| `--status-done` | `158 68% 56%` | éxito / conectado |
| `--status-error` | `357 84% 67%` | error / interrupción |
| `--chart-1..5` | cyan → azul → teal → índigo → gris frío | composición de contexto |

Regla: el cyan ocupa ~10% de la pantalla. Si un elemento no comunica estado,
selección o acción, no lleva cyan.

## Tipografía

- **Display / títulos:** Space Grotesk (`--font-display`), tracking entre
  `-0.02em` y `-0.035em`.
- **UI / cuerpo:** Inter (`--font-sans`).
- **Datos:** JetBrains Mono (`--font-mono`) con `tabular-nums`.
- Escala base 15px. Etiquetas de instrumento: 9–10px, uppercase, tracking
  `0.12–0.16em`, color muted.

## Estructura

- Barra de mando 56px, marca `agent viz / opencode`, hairline de señal con
  barrido lento bajo la cabecera.
- Riel de sesiones 300px: filas de canal (no tarjetas), barra de señal de 2px
  en la sesión activa.
- Lienzo del grafo: dot grid tenue sobre un radial `surface-1 → surface-0`;
  carriles de ejecución al 1.2% de señal; controles React Flow con el mismo
  lenguaje de instrumento.
- Inspector 360px (redimensionable): cabecera con tabs segmentados, identidad,
  retícula de métricas, contexto y tabs de secciones.
- Página de sesiones: tablero de tarjetas (1/2/3 columnas) donde la sesión en
  vivo ocupa dos columnas y lleva el sello `EN VIVO`.
- Punto de corte responsive: `<= 1024px` usa el tablist móvil de primer nivel
  (Sesiones · Grafo · Detalle · Chat).

## Componentes

- **Botón primario:** fondo cyan, texto casi negro, radio 10px, altura 36px,
  `active:scale-[0.98]`.
- **Outline:** `surface-1/70` + hairline; hover con borde cyan al 40%.
- **Tabs:** lista pill con hairline; activo con borde de contraste y
  `bg-background` (sin cambio de ancho); foco por `outline` para forced-colors.
- **Inputs:** inset (`bg-input/60`), hairline, focus ring cyan al 20%.
- **Tarjeta de nodo:** `surface-2`, radio 6px, rail de estado a la izquierda,
  selección con borde cyan y halo de 1px; nunca sombra dramática.
- **Empty states:** panel hairline con icono en badge de 44px y acción link
  cyan; centrados en el lienzo.
- **Chat:** filas neutras, mensajes propios en panel `surface-2`, compositor
  contenido con hairline y botón de acción ghost (contrato F2).

## Movimiento

- Entradas 150–260ms con `cubic-bezier(0.23, 1, 0.32, 1)`.
- Barrido del rail de nodo activo (`rail-scan`) y pulso de señal en puntos
  vivos; siempre con equivalente estático y respeto a `prefers-reduced-motion`.
- Sin `transition: all`; solo color, borde, sombra, transform y opacidad.

## Accesibilidad

- Foco visible global con `outline` cyan de 2px; los primitivos que usan ring
  mantienen respaldo `forced-colors`.
- Estados siempre con etiqueta textual además del color (badges, contadores,
  dots con `aria-label`).
- Contraste: texto primario y muted sobre `surface-0` ≥ 7:1; cyan sobre fondo
  oscuro ≥ 10:1; texto oscuro sobre cyan ≥ 12:1.

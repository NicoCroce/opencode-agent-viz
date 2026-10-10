# Cómo funciona

## Vista de alto nivel

```text
┌──────────┐     /oc (proxy Vite)     ┌────────────────────────┐
│ Browser  │ ───────────────────────► │ OpenCode               │
│ (React)  │ ◄─────────────────────── │ background service     │
└──────────┘       SSE /event         └────────────────────────┘
      ▲                                          │
      │                                          ▼
      │                                  ┌───────────────┐
      │                                  │ SQLite (sesiones,│
      │                                  │ mensajes, etc.) │
      └──────────────────────────────────┴───────────────┘
```

El visor es **read-only** y se conecta al **background service** de OpenCode: el
mismo proceso al que se conecta el TUI, **no** a un `opencode serve` aparte.
Ambos comparten la base SQLite, pero solo el proceso que corre tus sesiones
emite sus eventos SSE en vivo.

> Si los eventos llegaran solo al refrescar, casi siempre es porque se está
> apuntando a un `opencode serve` distinto del que corre las sesiones: hay que
> asegurarse de que `OPENCODE_URL` sea la del background service.

## Conexión

`pnpm start` ejecuta `scripts/start.sh`, que:

1. descubre la URL con `opencode service status`;
2. toma el password de `~/.config/opencode/service.json`;
3. los exporta como `OPENCODE_URL` / `OPENCODE_PASSWORD` y levanta Vite.

El proxy `/oc` de Vite reenvía al service e inyecta el header
`Authorization: Basic` (usuario `opencode`), de modo que **el navegador nunca
maneja credenciales**.

| Variable | Origen | Descripción |
|---|---|---|
| `OPENCODE_URL` | `opencode service status` | URL del background service (fallback standalone: `http://127.0.0.1:4096`) |
| `OPENCODE_PASSWORD` | `~/.config/opencode/service.json` | Password del server (HTTP Basic); si falta, `/oc` responde 401 |

## Capas

| Capa | Responsabilidad |
|---|---|
| **Infrastructure** | Cliente del SDK, `EventStreamProvider`, rutas globales |
| **Application** | Componentes compartidos (shadcn/ui + wrappers), hooks, helpers |
| **Domains** | Módulos funcionales: Connection, Sessions, Graph, Inspector |

Arquitectura por **dominios funcionales**: cada dominio tiene su entidad, su
servicio (queries), sus rutas, sus componentes, hooks y páginas. El acceso al
SDK ocurre **solo** desde `*.service.ts`; los componentes consumen hooks.

## Flujo de datos

1. **Init:** TanStack Query carga sesiones, estados de sesión y agentes.
2. **Tiempo real:** una sola suscripción SSE (`EventStreamProvider`) despacha
   eventos al `queryClient` con `setQueryData`. Los eventos se agrupan en lotes
   (~100 ms) para evitar re-renders excesivos.
3. **Grafo:** una **función pura** deriva nodos y aristas del estado de las
   queries (`buildGraph(...)`). El layout (dagre, arriba→abajo) solo se recalcula
   cuando cambia la topología; los cambios de estado no disparan relayout.
4. **UI:** los componentes consumen hooks; los hooks consumen el `queryClient`.

Eventos procesados: ciclo de vida de sesión, estado de sesión, partes
significativas de mensajes (herramientas, permisos…). Texto y razonamiento se
**ignoran** en streaming: la UI usa texto consolidado.

## Read-only por diseño

El visor **nunca** envía prompts, aborta sesiones ni responde
permisos/preguntas. No hay endpoints de escritura ni mutaciones hacia OpenCode.
Es una garantía estructural, no una convención.

## Estados de pantalla

Toda pantalla con datos renderiza explícitamente, en orden:
**error → loading → vacío → datos**, y el estado de conexión siempre está
visible.

## Stack

React 19 · Vite 8 · TypeScript strict · TanStack Query 5 · React Router 7 ·
Tailwind 4 · shadcn/ui (Radix) · lucide-react · sonner · React Flow
(`@xyflow/react`) + dagre · `@opencode/client` 2.0.22 · Vitest.

## Comandos

| Comando | Propósito |
|---|---|
| `pnpm dev` | Dev server (Vite) |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint |
| `pnpm tsc` | Chequeo de tipos |
| `pnpm test` | Vitest |
| `pnpm test:watch` | Modo watch |
| `pnpm test:coverage` | Cobertura |
| `pnpm test:live` | Test de integración contra el background service |
| `pnpm fixture` | Captura un fixture de eventos real |

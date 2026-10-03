---
name: front-ddd-generator
description: Genera un dominio completo en el frontend React/tRPC: entity types, service tRPC, rutas, router, hooks (query + mutation + cache), páginas vacías y actualización de los archivos globales de registro.
---

# Front DDD Generator

## ⚠️ CONTROL DE CONTEXTO (ESTRICTO)

- **MODO AISLADO:** No uses `@workspace`. Solo el contexto que el usuario te provee.
- **TRABAJA UN DOMINIO A LA VEZ** y verifica errores tras crear cada archivo.
- **NO modifiques archivos fuera de `packages/app/`** excepto los dos archivos de registro global indicados al final.
- **VERIFICAR COMPONENTES:** Antes de cualquier componente, revisar que no exista ya en `packages/app/src/Application/Components/`.

## Herramientas Requeridas

- `read/readFile` — Para leer archivos de referencia del servidor (interfaces de dominio)
- `edit/createFile` — Para crear cada archivo del dominio frontend
- `edit/editFiles` — Para actualizar los archivos globales (Routes.tsx, MenuAccess.tsx)
- `diagnostics/getErrors` — Para verificar errores al finalizar

---

## Prerequisito: El Dominio Backend ya debe existir

Esta skill asume que el dominio ya fue creado con `back-ddd-generator`. Necesitas leer de:

- `packages/server/src/domains/[Domain]/Infrastructure/Routes/[Domain].routes.ts` → para el tipo `T[Domain]Router` (el contrato tRPC del dominio)

---

## Protocolo de Preguntas (OBLIGATORIO si faltan datos)

Antes de generar, pregunta al usuario:

1. **Nombre del dominio en el server** (carpeta, PascalCase): ej. `Products`
2. **Nombre de la entidad** (PascalCase singular): ej. `Product`
3. **¿Qué páginas necesita?** (Lista, Nueva, Editar, Detalle)
4. **¿Qué campos de búsqueda/filtro tiene la lista?**
5. **¿Necesita entrada en el menú de navegación?**

---

## Validación de Estructura (OBLIGATORIO)

Antes de crear el primer archivo, lista para el usuario el árbol exacto a crear. **No procedas sin aprobación.**

```
packages/app/src/Domains/[Domain]/
├── [Entity].entity.ts
├── [Domain].service.ts
├── [Domain].routes.tsx
├── [Domain].router.tsx
├── Components/
│   └── index.ts
├── Hooks/
│   ├── useGet[Entities].ts
│   ├── useGet[Entity].ts
│   ├── useAdd[Entity].ts
│   ├── useUpdate[Entity].ts
│   ├── useDelete[Entity].ts
│   ├── useCache[Entities].ts
│   └── index.ts
├── Pages/
│   ├── [Entity]List.page.tsx
│   ├── [Entity]New.page.tsx
│   ├── [Entity]Update.page.tsx
│   └── index.ts
└── index.ts

Archivos globales a actualizar:
  packages/app/src/Infrastructure/Routes.tsx
  packages/app/src/Domains/MenuAccess.tsx  (si necesita menú)
```

---

## Estructura de Archivos y Templates

### Variables de sustitución

- `[Entity]` = singular PascalCase → ej. `Product`
- `[Entities]` = plural PascalCase → ej. `Products`
- `[Domain]` = nombre del dominio carpeta → ej. `Products`
- `[domain]` = camelCase → ej. `products`
- `[DOMAIN]` = SCREAMING_SNAKE_CASE → ej. `PRODUCTS`

---

## Templates

Los templates de cada archivo están en `.opencode/skills/front-ddd-generator/templates.md`. Leerlo **solo al crear un dominio nuevo**; para cambios en un dominio existente, imitar los archivos hermanos del dominio.

## Convenciones de UI

### Button

- Por defecto NO pasar el atributo `size`. El tamaño default del tema es el correcto.
- NO agregar un componente `<Icon>` dentro del `<Button>`. Usar los atributos `icon` y `showIcon`:

```tsx
<Button onClick={() => null} icon={faEdit} showIcon />
```

### Estados de pantalla — Loading / Error / Empty (OBLIGATORIO)

Toda página o componente que obtiene datos (useQuery) implementa los tres estados en este orden:

```tsx
const { data, isLoading, isError, error } = service;

if (isError) return <EmptyScreenError message={error?.message} />;
if (isLoading) return <Skeleton />; // skeleton del dominio en Components/
if (!data?.length) return <EmptyScreenFilter onClick={openFilters} />;
```

**Componentes genéricos (siempre desde el barrel `@app/Application`):**

| Estado  | Componente          | Cuándo usarlo                                   |
| ------- | ------------------- | ----------------------------------------------- |
| Error   | `EmptyScreenError`  | La query falla (`isError`)                      |
| Vacío   | `EmptyScreenFilter` | No hay resultados de filtros/búsqueda           |
| Vacío   | `EmptyState`        | Empty state con título/descripción/ícono/CTA    |
| Loading | `Skeleton`          | Base para skeletons del dominio (`ui/skeleton`) |

**Reglas:**

1. NUNCA texto suelto inline para estos estados (`<Text.Muted>Cargando</Text.Muted>`, `<p>`). SIEMPRE los componentes genéricos.
2. NO dejar fallbacks inalcanzables `: <Text.Muted>Cargando</Text.Muted>` al final de un ternario. Si `isLoading` es false, no hay error y no hay data → empty state.
3. Los skeletons del dominio van en `Components/` como archivo propio (`[Entity]TableSkeleton.tsx`, `[Entity]CardsSkeleton.tsx`), construidos sobre `Skeleton`. Si usás `DataTable`/`DataList`, usá sus `.Skeleton` estáticos.
4. Los empty states domain-specific usan `EmptyState` internamente (base visual única, contexto dinámico en el dominio).

### Botones que ejecutan servicios — SIEMPRE con `isLoading`

Todo botón que dispara una mutation recibe `isLoading={isPending}` (spinner + disable automático del `Button` del proyecto):

```tsx
// ✅ Correcto
<Button type="submit" isLoading={isPending}>Guardar</Button>

// ❌ Incorrecto — sin feedback visual
<Button type="submit" disabled={isPending}>Guardar</Button>
```

- NUNCA solo `disabled={isPending}` en un botón que ejecuta un servicio.
- Los botones "Cancelar" acompañantes se deshabilitan con `disabled={isPending}` (sin spinner).
- Botones fuera del proyecto (`ui/button` raw, `AlertDialogAction`, `<button>` nativo) que ejecutan servicio: usar el `Button` wrapper con `isLoading`, o `disabled` + indicador manual.

---

## Archivos Globales a Actualizar

### 1. `packages/app/src/Infrastructure/Routes.tsx`

Agregar el import del router y sumarlo al array `AllRoutes`:

```typescript
import { [Domain]Router } from '@app/Domains/[Domain]';

export const AllRoutes = [
  // ... existentes ...
  ...[Domain]Router,
];
```

### 2. `packages/app/src/Domains/MenuAccess.tsx` (si el dominio necesita menú)

Agregar la entrada de menú siguiendo el patrón de las entradas existentes.

---

## Checklist Final

Tras crear todos los archivos, ejecuta `diagnostics/getErrors` y verifica:

- [ ] No hay errores de TypeScript
- [ ] `[Entity].entity.ts` deriva los tipos con `inferRouterOutputs` (nunca `I[Entity]` del server — desvío D1)
- [ ] `[Domain].service.ts` importa el tipo correcto del dominio server
- [ ] Todos los hooks usan `[Domain]Service` (no instancias directas de tRPC)
- [ ] `Routes.tsx` incluye el nuevo `[Domain]Router`
- [ ] Las páginas exportan componentes con nombre correcto
- [ ] La `[Entity]ListPage` implementa los tres estados: `isError` → `EmptyScreenError`, `isLoading` → skeleton del dominio, empty → `EmptyScreenFilter`/`EmptyState` (sin texto inline ni fallbacks `Cargando`)
- [ ] Los botones que ejecutan mutations reciben `isLoading={isPending}` (nunca solo `disabled`)
- [ ] `index.ts` raíz hace barrel export de todo

---
name: test-generator
description: Guía a @blendverse-tester para testear reglas de negocio reales (no stubs) por capa — Entity, Use Case, Service, Controller, Repository y Hooks — usando specs existentes del repo como canon.
---

# Skill: test-generator

## Canon (leer solo el de la capa que vas a testear y copiar su estructura)

| Capa | Spec de referencia |
| ---- | ------------------ |
| Entity | `packages/server/src/domains/Certificates/Domain/specs/Certificate.entity.spec.ts` |
| Use Case | `packages/server/src/domains/Themes/Application/UseCases/specs/GetTheme.usecase.spec.ts` |
| Service | `packages/server/src/domains/Themes/Application/specs/Themes.service.spec.ts` |
| Controller (tRPC) | `packages/server/src/domains/Themes/Infrastructure/Controllers/specs/Themes.controller.spec.ts` |
| Repository | `packages/server/src/domains/Certificates/Infrastructure/Databases/specs/CertificatesRepository.addCertificate.spec.ts` |
| Hook (front) | `packages/app/src/Domains/Auth/Hooks/specs/useLoginUser.spec.tsx` |
| Componente (front) | `packages/app/src/Domains/Auth/Components/specs/LoginForm.spec.tsx` |

Antes de crear un spec, mirar si el dominio ya tiene uno para esa capa y seguir ese estilo; no sobreescribir specs existentes (agregar casos).

## Qué validar por capa

- **Entity**: requeridos/opcionales en `create()`, validaciones del constructor, `values`/`toJSON()` devuelven los campos.
- **Use Case**: llama al repositorio con los argumentos exactos; propaga `requestContext.values.ownerId`; caso no encontrado (`null`/`AppError` con su código).
- **Service**: delega en `executeUseCase` con el use case y el input correctos.
- **Controller**: input Zod inválido → `TRPCError`; delega al service con `requestContext`; cookies si las escribe; `protectedProcedure` sin token → `UNAUTHORIZED`.
- **Hook**: endpoint tRPC correcto, parámetros, invalidaciones de query en mutations.

Datos concretos siempre; nada de `it.todo`, stubs vacíos ni `any` (usar el tipo real o `as never`).

## Mocks

- Controllers: mockear `@server/Infrastructure` reexportando `router`/`protectedProcedure` desde `@server/Infrastructure/trpc/TrpcInstance.js`, más `utils/JWT` y `utils/pino` (ver canon).
- Cross-domain: importar la **entidad** real con `await import(...)` dentro del factory y mockear los **use cases** como clases vacías:

```typescript
vi.mock('@server/domains/Other', async () => {
  const { OtherEntity } = await import('@server/domains/Other/Domain/Other.entity.js');
  return { OtherEntity, GetOtherUseCase: class GetOtherUseCase {} };
});
```

## No requieren tests

`*.model.ts`, `*.routes.ts(x)`, `*.router.tsx`, `*.di.ts`, `index.ts`, `Pages/**` y componentes puramente visuales. Un archivo merece test si tiene validaciones, reglas de negocio, propagación de `ownerId`, llamadas a dependencias con argumentos específicos o manejo de errores con código.

# Contract — Texto enriquecido (`Application/Components/Molecules/RichText.tsx`)

Cubre US1 (FR-001, FR-002, FR-005, FR-006, FR-007). Componente compartido por Inspector y History; genérico y sin dependencia del dominio.

## Firma

```ts
interface RichTextProps {
  text: string;
  variant?: 'answer' | 'reasoning';   // por defecto 'answer'
  className?: string;
}

export const RichText = ({ text, variant = 'answer', className }: RichTextProps) => ...
```

## Reglas

- **FR-001**: renderiza formato enriquecido — bloques de código, listas, énfasis y tablas — vía `react-markdown` + `remark-gfm`.
- **FR-001 (seguridad)**: construye **elementos React**, nunca `dangerouslySetInnerHTML`; el HTML crudo no se interpreta como activo. `rehype-sanitize` restringe esquemas de URL y atributos (neutraliza contenido no confiable). Un `<script>` en el texto se muestra como texto, no se ejecuta.
- **FR-002**: `variant` solo cambia el estilo; la visibilidad del razonamiento la controla el llamador con `useReasoningVisibility` (ocultar razonamiento no afecta a las respuestas).
- **FR-005/006**: `RichText` nunca recibe texto parcial: el llamador solo le pasa texto consolidado y, mientras el assistant no esté completo, muestra "en curso" en lugar del texto.
- **FR-007**: los adjuntos del mensaje de usuario no se renderizan con `RichText`; los lista `HistoryEntry` por nombre.

## `useReasoningVisibility()` — `Application/Hooks/useReasoningVisibility.ts`

```ts
function useReasoningVisibility(initial = false): {
  visible: boolean;
  toggle: () => void;
};
```

- Estado de vista local, sin persistencia (Assumption de la spec).
- `WorkspacePage` lo posee y lo pasa al Inspector (`AnswersSection`) y al overlay (`HistoryModal`) para que ambos coincidan.
- Sin React en la lógica de formato: el saneado y el parseo los hace la librería; el componente se prueba con Testing Library (listas, código, tabla, énfasis, neutralización).

## Estilo

- Prosa con la sans del visor (Inter); bloques de código con JetBrains Mono sobre `--surface-0` y borde `--border`.
- `variant === 'reasoning'` usa `--text-muted` para distinguirse de la respuesta.
- Sin sombras ni gradientes (Design Direction).

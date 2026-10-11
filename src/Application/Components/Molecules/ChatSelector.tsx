import { useId } from 'react';
import type {
  TAgentOption,
  TModelOption,
  TReasoningOption,
  TChatSelection,
} from '@app/Domains/Chat/Chat.entity';
import { Container, Label } from '@app/Application/Components';
import type { TOptions } from './Select';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface ChatSelectorProps {
  /** Agentes disponibles para la sesión (FR-008). */
  agents: TAgentOption[];
  /** Modelos disponibles, cada uno con sus variantes de razonamiento. */
  models: TModelOption[];
  /**
   * Variantes de razonamiento **del modelo elegido** (FR-008). El contenedor las
   * deriva del modelo activo; el selector nunca mezcla variantes de otro modelo.
   * Modelo sin variantes → lista vacía y el selector queda deshabilitado.
   */
  reasoning: TReasoningOption[];
  /** Combinación vigente de agente, modelo y variante. */
  selection: TChatSelection;
  /** Notifica la selección resultante tras un cambio. */
  onChange: (next: TChatSelection) => void;
  /** Escritura en curso: deshabilita los tres selectores. */
  isPending?: boolean;
}

interface SelectFieldProps {
  /** Nombre visible y accesible del control. */
  label: string;
  /** Valor controlado; vacío muestra el placeholder. */
  value: string;
  /** Texto mostrado cuando no hay valor. */
  placeholder: string;
  options: TOptions[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Selector etiquetado reutilizado por los tres campos.
 *
 * Usa los primitivos Radix de `ui/select` (el wrapper `Select` no expone
 * `disabled`) para poder deshabilitar el razonamiento sin variantes y bloquear
 * todo mientras hay una escritura en curso. El `<label>` asocia el nombre
 * accesible con el disparador; el estado nunca se comunica solo por color.
 */
const SelectField = ({
  label,
  value,
  placeholder,
  options,
  onValueChange,
  disabled = false,
}: SelectFieldProps) => {
  const id = useId();

  return (
    <Container space="small" className="min-w-0 flex-1">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Container>
  );
};

/**
 * Selectores de agente, modelo y razonamiento del chat (FR-008, SC-008).
 *
 * Molecule presentacional: no conoce el SDK ni los servicios; recibe las
 * opciones ya derivadas y emite la `TChatSelection` resultante. La variante de
 * razonamiento se acota al modelo elegido (`reasoning`); si el modelo no tiene
 * variantes la lista queda vacía y el control deshabilitado, sin bloquear el
 * envío. Operable por teclado, con foco visible y sin comunicar estado solo por
 * color (FR-021).
 */
export const ChatSelector = ({
  agents,
  models,
  reasoning,
  selection,
  onChange,
  isPending = false,
}: ChatSelectorProps) => {
  const agentOptions: TOptions[] = agents.map((agent) => ({
    value: agent.id,
    label: agent.label,
  }));
  const modelOptions: TOptions[] = models.map((model) => ({
    value: model.id,
    label: model.label,
  }));
  const reasoningOptions: TOptions[] = reasoning.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  const hasReasoning = reasoningOptions.length > 0;

  const handleAgentChange = (agent: string) => {
    onChange({ ...selection, agent, isDirty: true });
  };

  const handleModelChange = (modelId: string) => {
    // Al cambiar de modelo se descarta la variante anterior: pertenece al modelo previo.
    const model = models.find((option) => option.id === modelId);
    onChange({
      ...selection,
      model: model ? { ...model.ref } : null,
      isDirty: true,
    });
  };

  const handleReasoningChange = (variant: string) => {
    if (!selection.model) return;
    onChange({
      ...selection,
      model: { ...selection.model, variant },
      isDirty: true,
    });
  };

  return (
    <Container row space="small" className="flex-wrap">
      <SelectField
        label="Agente"
        value={selection.agent ?? ''}
        placeholder="Elegir agente"
        options={agentOptions}
        onValueChange={handleAgentChange}
        disabled={isPending}
      />
      <SelectField
        label="Modelo"
        value={selection.model?.id ?? ''}
        placeholder="Elegir modelo"
        options={modelOptions}
        onValueChange={handleModelChange}
        disabled={isPending}
      />
      <SelectField
        label="Razonamiento"
        value={selection.model?.variant ?? ''}
        placeholder={hasReasoning ? 'Elegir variante' : 'Sin variantes'}
        options={reasoningOptions}
        onValueChange={handleReasoningChange}
        disabled={isPending || !hasReasoning}
      />
    </Container>
  );
};

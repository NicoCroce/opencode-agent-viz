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
import { ChatOptionCombobox } from './ChatOptionCombobox';

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

interface SelectChipProps {
  /** Nombre accesible del chip (solo lector de pantalla, sin label visible). */
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
 * Chip compacto (estilo Copilot) para listas cortas (razonamiento).
 *
 * Agente y modelo usan `ChatOptionCombobox` (Popover + Command, con buscador y
 * altura máxima) porque son listas largas; el razonamiento se acota al modelo
 * elegido y rara vez tiene más de un puñado de variantes, así que conserva el
 * `ui/select` (Radix) —más simple y ya probado— con el disparador como chip.
 *
 * Usa los primitivos Radix de `ui/select` (el wrapper `Select` no expone
 * `disabled`) para poder deshabilitar el razonamiento sin variantes y bloquear
 * todo mientras hay una escritura en curso. El nombre accesible se asocia con un
 * `<label class="sr-only">` al disparador (no hay etiqueta visible encima); el
 * estado nunca se comunica solo por color. El `chevron` del `SelectTrigger`
 * señala que es un control desplegable.
 */
const SelectChip = ({
  label,
  value,
  placeholder,
  options,
  onValueChange,
  disabled = false,
}: SelectChipProps) => {
  const id = useId();

  return (
    <Container row align="center" className="w-auto">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="h-8 w-auto gap-1 rounded-full border-input bg-transparent px-3 text-xs"
        >
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
 * Chips de agente, modelo y razonamiento del chat (FR-008, SC-008).
 *
 * Molecule presentacional: no conoce el SDK ni los servicios; recibe las
 * opciones ya derivadas y emite la `TChatSelection` resultante. Cada control es
 * un **chip compacto** que muestra el valor vigente (p. ej. `sddorch`,
 * `DeepSeek V4.1 Flash`, `high`) con un chevron, sin label visible encima.
 * Agente y modelo abren un **combobox** con buscador interno y lista de altura
 * acotada (listas largas); la variante de razonamiento se acota al modelo
 * elegido (`reasoning`) y sigue con `ui/select`: si el modelo no tiene variantes
 * la lista queda vacía y el control deshabilitado, sin bloquear el envío.
 * Operable por teclado, con foco visible y sin comunicar estado solo por color
 * (FR-021).
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
    <Container row align="center" space="small" className="w-auto flex-wrap">
      <ChatOptionCombobox
        label="Agente"
        value={selection.agent ?? ''}
        placeholder="Elegir agente"
        options={agentOptions}
        onValueChange={handleAgentChange}
        disabled={isPending}
      />
      <ChatOptionCombobox
        label="Modelo"
        value={selection.model?.id ?? ''}
        placeholder="Elegir modelo"
        options={modelOptions}
        onValueChange={handleModelChange}
        disabled={isPending}
      />
      <SelectChip
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

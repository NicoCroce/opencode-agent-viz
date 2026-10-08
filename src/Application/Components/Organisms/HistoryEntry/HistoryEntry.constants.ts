import type { THistoryEntry } from '@app/Domains/History/History.entity';

/** Etiqueta plana de tipo de entrada (FR-003). */
export const HISTORY_KIND_LABEL: Record<THistoryEntry['kind'], string> = {
  user: 'Usuario',
  answer: 'Respuesta',
  reasoning: 'Razonamiento',
  tool: 'Herramienta',
  'agent-switched': 'Cambio de agente',
  'model-switched': 'Cambio de modelo',
  'location-switched': 'Cambio de ubicación',
  system: 'Sistema',
  synthetic: 'Sintético',
  skill: 'Skill',
  shell: 'Shell',
  compaction: 'Compactación',
  idle: 'Cierre de turno',
  question: 'Pregunta',
};

/** Franja plana a la izquierda que distingue el tipo de entrada (FR-003). */
export const HISTORY_KIND_STRIPE: Record<THistoryEntry['kind'], string> = {
  user: 'border-accent',
  answer: 'border-status-done',
  reasoning: 'border-border',
  tool: 'border-status-running',
  'agent-switched': 'border-status-idle',
  'model-switched': 'border-status-idle',
  'location-switched': 'border-status-idle',
  system: 'border-status-idle',
  synthetic: 'border-status-idle',
  skill: 'border-accent',
  shell: 'border-border',
  compaction: 'border-status-waiting',
  idle: 'border-status-done',
  question: 'border-accent',
};

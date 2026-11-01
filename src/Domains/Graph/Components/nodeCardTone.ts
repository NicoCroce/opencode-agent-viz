import { NODE_STATUS_COLOR } from '@app/Application/Helpers/nodeStatusColor';
import type { TNodeStatus } from '../Graph.entity';

/**
 * Tono visual del card de agente por estado (Foundations · "Nodo de agente ·
 * estados"): color de la barra superior, de la etiqueta de estado y del título,
 * más el borde/tinte propios del estado. La selección y el pendiente de
 * atención ganan al borde/tinte del estado (lo resuelve `AgentNode`).
 */
export interface TNodeCardTone {
  /** Fondo de la barra de estado superior (`NodeStatusRail`). */
  rail: string;
  /** Halo de la barra y del LED (solo la actividad en cyan). */
  glow: boolean;
  /** Color de la etiqueta mono de estado del encabezado. */
  label: string;
  /** Peso/color del título (un terminado se atenúa). */
  title: string;
  /** Borde del card en reposo. */
  border: string;
  /** Tinte del fondo sobre `--surface-1` (capa de imagen, no de color). */
  tint: string | null;
}

const ACTIVE: TNodeCardTone = {
  rail: NODE_STATUS_COLOR.running,
  glow: true,
  label: 'text-status-running',
  title: 'font-semibold text-foreground',
  border: 'border-border',
  tint: null,
};

const WAITING: TNodeCardTone = {
  rail: NODE_STATUS_COLOR['waiting-permission'],
  glow: false,
  label: 'text-status-waiting',
  title: 'font-semibold text-foreground',
  border: 'border-dashed border-status-waiting',
  tint: 'bg-linear-to-b from-status-waiting/[0.04] to-status-waiting/[0.04]',
};

const FAILED: TNodeCardTone = {
  rail: NODE_STATUS_COLOR.failed,
  glow: false,
  label: 'text-status-error',
  title: 'font-semibold text-foreground',
  border: 'border-status-error/40',
  tint: 'bg-linear-to-b from-status-error/[0.04] to-status-error/[0.04]',
};

export const NODE_CARD_TONE: Record<TNodeStatus, TNodeCardTone> = {
  created: {
    rail: 'bg-status-idle/30',
    glow: false,
    label: 'text-status-idle',
    title: 'font-medium text-muted-foreground',
    border: 'border-dashed border-border',
    tint: null,
  },
  running: ACTIVE,
  retrying: ACTIVE,
  compacting: ACTIVE,
  'waiting-permission': WAITING,
  'waiting-input': WAITING,
  succeeded: {
    rail: 'bg-status-idle/50',
    glow: false,
    label: 'text-muted-foreground',
    title: 'font-medium text-foreground/80',
    border: 'border-border',
    tint: null,
  },
  failed: FAILED,
  interrupted: FAILED,
};

/** Tinte del card seleccionado (gana al del estado). */
export const SELECTED_TINT =
  'bg-linear-to-b from-accent/[0.04] to-accent/[0.04]';

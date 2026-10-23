import type { TTurnAnalysis } from '../Efficiency.entity';
import { EfficiencyTurnCards } from './EfficiencyTurnCards';
import { EfficiencyTurnTable } from './EfficiencyTurnTable';

interface EfficiencyTurnsProps {
  /** Turnos del informe; única fuente de datos para ambas presentaciones. */
  turns: TTurnAnalysis[];
  /** Presentación: `true` tarjetas (móvil), `false` tabla (escritorio). */
  isMobile: boolean;
}

/**
 * Selector presentacional de la sección de turnos (FR-034, contrato overlay
 * §5.4): la misma lista de turnos se pinta como tarjetas en móvil o como tabla
 * en escritorio. Sin `md:hidden` ni duplicación de datos; la decisión llega por
 * prop desde `EfficiencyReport` (`useDevice` en el hook de la página).
 */
export const EfficiencyTurns = ({ turns, isMobile }: EfficiencyTurnsProps) =>
  isMobile ? (
    <EfficiencyTurnCards turns={turns} />
  ) : (
    <EfficiencyTurnTable turns={turns} />
  );

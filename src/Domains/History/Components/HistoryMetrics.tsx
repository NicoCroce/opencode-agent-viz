import { Container, Metric } from '@app/Application/Components';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import type { THistoryHeaderView } from '../lib/historyHeaderView';

interface HistoryMetricsProps {
  /** Vista derivada con los valores ya formateados o `null` (FR-038). */
  view: THistoryHeaderView;
}

/**
 * Datos de ejecución de la cabecera del histórico (FR-010): fila de métricas
 * Modelo, Estado, Costo, Tokens, Duración, Resultado y Directorio. Un valor
 * ausente se delega a `Metric`, que renderiza "no disponible" (FR-038).
 * Presentación pura.
 */
export const HistoryMetrics = ({ view }: HistoryMetricsProps) => (
  <Container row space="large" className="flex-wrap">
    <Metric label="Modelo" value={view.modelValue} />
    <Metric label="Estado" value={NODE_STATUS_LABEL[view.status]} />
    <Metric label="Costo" value={view.costValue} />
    <Metric label="Tokens" value={view.tokensValue} />
    <Metric label="Duración" value={view.durationValue} />
    <Metric label="Resultado" value={view.outcomeValue} />
    <Metric label="Directorio" value={view.directoryValue} />
  </Container>
);

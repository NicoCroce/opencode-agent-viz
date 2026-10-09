import { formatModelRef } from '@app/Application/Helpers';
import type {
  THistoryAgentSwitchedEntry,
  THistoryLocationSwitchedEntry,
  THistoryModelSwitchedEntry,
} from '@app/Domains/History/History.entity';

/** Cambio de agente, con el anterior si lo hay (FR-003). */
export const AgentSwitchedBody = ({
  entry,
}: {
  entry: THistoryAgentSwitchedEntry;
}) => (
  <p className="font-mono text-xs text-foreground">
    {entry.agent}
    {entry.previous ? (
      <span className="text-muted-foreground"> · antes {entry.previous}</span>
    ) : null}
  </p>
);

/** Cambio de modelo (`provider/id`), nunca un valor inventado (FR-038). */
export const ModelSwitchedBody = ({
  entry,
}: {
  entry: THistoryModelSwitchedEntry;
}) => (
  <p className="break-all font-mono text-xs text-foreground">
    {formatModelRef(entry.model)}
    {entry.previous ? (
      <span className="text-muted-foreground">
        {' '}
        · antes {formatModelRef(entry.previous)}
      </span>
    ) : null}
  </p>
);

/** Cambio de directorio de trabajo. */
export const LocationSwitchedBody = ({
  entry,
}: {
  entry: THistoryLocationSwitchedEntry;
}) => (
  <p className="break-all font-mono text-xs text-foreground">
    {entry.directory}
  </p>
);

import { Container } from '@app/Application/Components/Layout';
import type {
  THistoryShellEntry,
  TShellStatus,
} from '@app/Domains/History/History.entity';

/** Estado real de una ejecución de shell. */
const SHELL_LABEL: Record<TShellStatus, string> = {
  running: 'En curso',
  exited: 'Finalizado',
  timeout: 'Agotado',
  killed: 'Interrumpido',
};

interface ShellEntryBodyProps {
  entry: THistoryShellEntry;
}

/** Ejecución de shell: comando, estado real y `exit` cuando existe. */
export const ShellEntryBody = ({ entry }: ShellEntryBodyProps) => (
  <Container space="none" className="gap-1!">
    <p className="break-all font-mono text-xs text-foreground">
      $ {entry.command}
    </p>
    <p className="font-mono text-[11px] text-muted-foreground">
      <span className="text-foreground">{SHELL_LABEL[entry.status]}</span>
      {entry.exit !== null ? ` · exit ${entry.exit}` : null}
    </p>
  </Container>
);

import { Container } from '@app/Application/Components';

interface ErrorsSectionProps {
  errors: { message: string; at: number }[];
}

export const ErrorsSection = ({ errors }: ErrorsSectionProps) => (
  <Container space="small">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Errores
    </span>
    {errors.length === 0 ? (
      <p className="text-xs text-muted-foreground">Sin errores.</p>
    ) : (
      <Container space="small">
        {errors.map((error, index) => (
          <p key={`${error.at}-${index}`} className="text-xs text-status-error">
            {error.message}
          </p>
        ))}
      </Container>
    )}
  </Container>
);

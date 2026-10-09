import { Container } from '@app/Application/Components';
import { SectionFrame } from '@app/Application/Components/Molecules';

interface ErrorsSectionProps {
  errors: { message: string; at: number }[];
}

export const ErrorsSection = ({ errors }: ErrorsSectionProps) => (
  <SectionFrame
    title="Errores"
    isEmpty={errors.length === 0}
    emptyLabel="Sin errores."
  >
    <Container space="small">
      {errors.map((error, index) => (
        <p key={`${error.at}-${index}`} className="text-xs text-status-error">
          {error.message}
        </p>
      ))}
    </Container>
  </SectionFrame>
);

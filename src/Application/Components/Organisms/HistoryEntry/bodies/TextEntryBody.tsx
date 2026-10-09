import {
  InProgressText,
  RichText,
} from '@app/Application/Components/Molecules';

interface TextEntryBodyProps {
  text: string;
  isComplete: boolean;
  variant: 'answer' | 'reasoning';
}

/**
 * Cuerpo de texto del assistant (FR-006). Completo → `RichText` (con saneo);
 * sin consolidar → `InProgressText`, sin presentar texto parcial como completo.
 */
export const TextEntryBody = ({
  text,
  isComplete,
  variant,
}: TextEntryBodyProps) =>
  isComplete ? (
    <RichText text={text} variant={variant} />
  ) : (
    <InProgressText />
  );

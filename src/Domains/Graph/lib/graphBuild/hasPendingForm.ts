import type { FormDetail } from '@opencode/client';

/** Un formulario cuenta como pendiente solo si su estado resuelto es `pending`. */
export const hasPendingForm = (
  forms: FormDetail[],
  sessionId: string,
): boolean =>
  forms.some(
    (form) => form.sessionID === sessionId && form.state.status === 'pending',
  );

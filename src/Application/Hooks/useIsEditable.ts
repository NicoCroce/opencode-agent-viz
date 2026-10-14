// El visor no tiene concepto de "modo edición": la edición está siempre activa,
// así que este hook devuelve `true` de forma intencional (no es un pendiente).
// Existe para que los consumidores (Input, Textarea) no codifiquen ese `true` a
// mano y puedan admitir un contexto de solo lectura sin acoplarse a él.
export const useIsEditable = () => {
  return true;
};

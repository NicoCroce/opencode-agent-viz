/**
 * Barrel del dominio Chat.
 *
 * El chat es un panel/pestaña, no una ruta propia (plan §Notas 3): no define
 * `router.tsx` ni `Pages/`. Su API pública se completa por fases —`service`,
 * `lib`, `Hooks` y `Components` se añaden en sus tareas—; aquí se re-exporta lo
 * ya disponible para no romper la compilación.
 */
export * from './Chat.entity';
export * from './chat.routes';
export * from './Chat.service';
export * from './Hooks/useChatController';
export * from './Hooks/useChatDraft';
export * from './Components/ChatPanel';
export * from './Components/ChatTimeline';

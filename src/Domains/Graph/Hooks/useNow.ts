/**
 * Shim de compatibilidad (SH-02): el reloj en vivo vive ahora en
 * `Application/Hooks/useNow` con firma por objeto de opciones. Se conserva este
 * archivo para no romper el barrel `Hooks/index.ts`, el re-export de
 * `Graph/index.ts` ni los imports profundos de los specs (p. ej.
 * `WorkspacePage.perf.spec.tsx`).
 */
export {
  useNow,
  DEFAULT_NOW_INTERVAL_MS,
  type TUseNowOptions,
} from '@app/Application/Hooks/useNow';

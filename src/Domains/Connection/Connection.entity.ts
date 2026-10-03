export type TConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export const CONNECTION_LABEL: Record<TConnectionState, string> = {
  connected: 'Conectado',
  reconnecting: 'Reconectando',
  disconnected: 'Desconectado',
};

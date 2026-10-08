export interface EventBatcher<T> {
  push: (item: T) => void;
  flushNow: () => void;
  cancel: () => void;
}

/**
 * Acumula items y los entrega agrupados a `onFlush` cada `flushIntervalMs`
 * (batching ~100 ms). El primer `push` programa el flush; los siguientes solo
 * encolan hasta que el timer dispara.
 *
 * `flushNow` vacía el buffer de inmediato; `cancel` descarta el timer pendiente
 * sin vaciar (cleanup de unmount).
 */
export const createEventBatcher = <T>({
  flushIntervalMs,
  onFlush,
}: {
  flushIntervalMs: number;
  onFlush: (items: T[]) => void;
}): EventBatcher<T> => {
  let buffer: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flushNow = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const items = buffer;
    if (items.length === 0) return;
    buffer = [];
    onFlush(items);
  };

  const push = (item: T) => {
    buffer.push(item);
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      flushNow();
    }, flushIntervalMs);
  };

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { push, flushNow, cancel };
};

import { useCallback, useState } from 'react';

export const useFollowMode = (activeNodeId: string | null) => {
  const [enabled, setEnabled] = useState(false);

  const toggle = useCallback(() => setEnabled((value) => !value), []);

  return {
    enabled,
    toggle,
    followNodeId: enabled ? activeNodeId : null,
  };
};

import { QueryClient } from '@tanstack/react-query';
import { STORE_KEY } from '../Hooks/useGlobalStore';

export const registerEventViewport = (queryClient: QueryClient) => {
  setStoreIsMobile(window.innerWidth, queryClient);
  window.addEventListener('resize', (event: UIEvent) => {
    const target = event.currentTarget as Window;
    setStoreIsMobile(target.innerWidth, queryClient);
  });
};

const setStoreIsMobile = (width: number, queryClient: QueryClient) => {
  const isMobile = width <= 768;
  if (queryClient.getQueryData([STORE_KEY.isMobile]) !== isMobile)
    queryClient.setQueryData([STORE_KEY.isMobile], isMobile);
};

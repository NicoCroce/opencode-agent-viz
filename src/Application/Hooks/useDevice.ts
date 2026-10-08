import { STORE_KEY, useGlobalStore } from './useGlobalStore';

export const useDevice = () => {
  let { data } = useGlobalStore(STORE_KEY.isMobile);

  if (data === undefined) data = true;

  return {
    isMobile: data,
    isDesktop: !data,
  };
};

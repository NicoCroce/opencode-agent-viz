import { UNAVAILABLE } from './format/constants';

export const formatTokens = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return UNAVAILABLE;
  }
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
};

import { UNAVAILABLE } from './format/constants';

export const formatCost = (
  value: number | null | undefined,
  currency = '$',
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return UNAVAILABLE;
  }
  if (value === 0) return `${currency}0.00`;
  if (value < 0.1) return `${currency}${value.toFixed(4)}`;
  return `${currency}${value.toFixed(2)}`;
};

import { formatCurrency as formatCurrencyWithConfig, getCurrencyConfig } from './currency';

export const formatCurrency = (
  value: number | null | undefined,
) => {
  return formatCurrencyWithConfig(value, getCurrencyConfig());
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};


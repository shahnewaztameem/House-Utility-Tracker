// Currency configuration - can be changed via environment variable or API
export interface CurrencyConfig {
	name: string;
	symbol: string;
	code: string;
	locale: string;
	decimal_places: number;
}

const DEFAULT_CURRENCY: CurrencyConfig = {
	name: 'Bangladeshi Taka',
	symbol: '৳',
	code: 'BDT',
	locale: 'bn-BD',
	decimal_places: 2,
};

let currencyConfig: CurrencyConfig = DEFAULT_CURRENCY;

export const setCurrencyConfig = (config: CurrencyConfig) => {
	currencyConfig = config;
};

export const getCurrencyConfig = (): CurrencyConfig => {
	return currencyConfig;
};

export const formatCurrency = (
	value: number | null | undefined,
	config?: CurrencyConfig
): string => {
	const cfg = config || currencyConfig;
	const numValue = value ?? 0;
	const formatted = new Intl.NumberFormat(cfg.locale, {
		minimumFractionDigits: cfg.decimal_places,
		maximumFractionDigits: cfg.decimal_places,
	}).format(numValue);

	return `${cfg.symbol} ${formatted}`;
};

export const getCurrencySymbol = (): string => {
	return currencyConfig.symbol;
};


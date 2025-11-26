<?php

namespace App\Helpers;

class CurrencyHelper
{
    /**
     * Get the default currency from config.
     */
    public static function getDefaultCurrency(): string
    {
        return config('currency.default', 'BDT');
    }

    /**
     * Get currency configuration.
     */
    public static function getCurrencyConfig(string $currency = null): array
    {
        $currency = $currency ?? self::getDefaultCurrency();
        $currencies = config('currency.currencies', []);

        return $currencies[$currency] ?? $currencies['BDT'] ?? [
            'name' => 'Bangladeshi Taka',
            'symbol' => '৳',
            'code' => 'BDT',
            'locale' => 'bn-BD',
            'decimal_places' => 2,
        ];
    }

    /**
     * Format a number as currency.
     */
    public static function format(float|int $amount, ?string $currency = null): string
    {
        $config = self::getCurrencyConfig($currency);
        $formatted = number_format($amount, $config['decimal_places'], '.', ',');

        return $config['symbol'] . ' ' . $formatted;
    }

    /**
     * Get currency symbol.
     */
    public static function symbol(?string $currency = null): string
    {
        $config = self::getCurrencyConfig($currency);
        return $config['symbol'];
    }

    /**
     * Get currency code.
     */
    public static function code(?string $currency = null): string
    {
        $config = self::getCurrencyConfig($currency);
        return $config['code'];
    }
}


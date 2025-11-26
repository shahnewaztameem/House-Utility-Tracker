<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Currency
    |--------------------------------------------------------------------------
    |
    | This option controls the default currency used throughout the application.
    | Supported values: 'BDT' (Taka), 'USD' (US Dollar)
    |
    */

    'default' => env('APP_CURRENCY', 'BDT'),

    /*
    |--------------------------------------------------------------------------
    | Currency Configuration
    |--------------------------------------------------------------------------
    |
    | Define currency symbols, names, and formatting options.
    |
    */

    'currencies' => [
        'BDT' => [
            'name' => 'Bangladeshi Taka',
            'symbol' => '৳',
            'code' => 'BDT',
            'locale' => 'bn-BD',
            'decimal_places' => 2,
        ],
        'USD' => [
            'name' => 'US Dollar',
            'symbol' => '$',
            'code' => 'USD',
            'locale' => 'en-US',
            'decimal_places' => 2,
        ],
    ],
];


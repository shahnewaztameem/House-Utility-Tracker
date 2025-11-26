<?php

use App\Services\TelegramBotService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule monthly due notifications on the 10th of each month
Schedule::call(function () {
    $botService = app(TelegramBotService::class);
    $botService->sendMonthlyDueNotification();
})->monthlyOn(10, '09:00')->name('telegram-monthly-due-notifications');

<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BillingSettingController;
use App\Http\Controllers\Api\BillShareController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ElectricityReadingController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\TelegramController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
    });
});

// Telegram webhook (no auth required - Telegram will call this)
Route::post('telegram/webhook', [TelegramController::class, 'webhook']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('menu', [\App\Http\Controllers\Api\MenuController::class, 'index']);
    Route::post('menu/check-route', [\App\Http\Controllers\Api\MenuController::class, 'checkRoute']);
    Route::get('dashboard', DashboardController::class);

    Route::get('users', [UserController::class, 'index'])
        ->middleware('role:admin,super_admin');
    Route::post('users', [UserController::class, 'store'])
        ->middleware('role:super_admin');
    Route::match(['put', 'patch'], 'users/{user}', [UserController::class, 'update'])
        ->middleware('role:super_admin');

    Route::get('billing-settings', [BillingSettingController::class, 'index']);
    Route::put('billing-settings', [BillingSettingController::class, 'update'])
        ->middleware('role:super_admin');

    Route::get('bills/month-year-options', [BillController::class, 'getMonthYearOptions']);
    Route::get('bills', [BillController::class, 'index']);
    Route::get('bills/{bill}', [BillController::class, 'show']);
    Route::post('bills', [BillController::class, 'store'])
        ->middleware('role:admin,super_admin');
    Route::match(['put', 'patch'], 'bills/{bill}', [BillController::class, 'update'])
        ->middleware('role:admin,super_admin');
    Route::delete('bills/{bill}', [BillController::class, 'destroy'])
        ->middleware('role:admin,super_admin');

    Route::get('bill-shares', [BillShareController::class, 'index']);
    Route::get('bill-shares/{billShare}', [BillShareController::class, 'show']);
    Route::post('bill-shares', [BillShareController::class, 'store'])
        ->middleware('role:admin,super_admin');
    Route::patch('bill-shares/{billShare}', [BillShareController::class, 'update'])
        ->middleware('role:admin,super_admin');
    Route::delete('bill-shares/{billShare}', [BillShareController::class, 'destroy'])
        ->middleware('role:admin,super_admin');

    Route::get('payments', [PaymentController::class, 'index']);
    Route::post('payments', [PaymentController::class, 'store']);
    Route::delete('payments/{payment}', [PaymentController::class, 'destroy'])
        ->middleware('role:admin,super_admin');

    Route::get('electricity-readings', [ElectricityReadingController::class, 'index'])
        ->middleware('role:admin,super_admin');
    Route::get('electricity-readings/by-month-year', [ElectricityReadingController::class, 'byMonthYear'])
        ->middleware('role:admin,super_admin');
    Route::post('electricity-readings', [ElectricityReadingController::class, 'store'])
        ->middleware('role:admin,super_admin');
    Route::match(['put', 'patch'], 'electricity-readings/{electricityReading}', [ElectricityReadingController::class, 'update'])
        ->middleware('role:admin,super_admin');
    Route::delete('electricity-readings/{electricityReading}', [ElectricityReadingController::class, 'destroy'])
        ->middleware('role:admin,super_admin');

    // Telegram endpoints
    Route::get('telegram/my-chat-id', [TelegramController::class, 'getMyChatId']);
    Route::post('telegram/my-chat-id', [TelegramController::class, 'updateMyChatId']);
    Route::post('telegram/test-message', [TelegramController::class, 'testMessage'])
        ->middleware('role:admin,super_admin');
});


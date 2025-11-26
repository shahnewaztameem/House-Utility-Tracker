<?php

namespace App\Http\Controllers\Api;

use App\Helpers\CurrencyHelper;
use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\BillShare;
use App\Models\BillingSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $shareQuery = BillShare::query();
        $billQuery = Bill::query()->with(['shares.user'])->latest();

        if (! $user->isAdmin()) {
            $shareQuery->where('user_id', $user->id);
            $billQuery->whereIn(
                'id',
                BillShare::where('user_id', $user->id)->pluck('bill_id')
            );
        }

        $totalDue = (clone $shareQuery)->sum('amount_due');
        $totalPaid = (clone $shareQuery)->sum('amount_paid');
        $outstanding = $totalDue - $totalPaid;

        $latestBills = $billQuery->limit(5)->get();

        $settings = BillingSetting::query()
            ->orderBy('key')
            ->get()
            ->mapWithKeys(fn ($setting) => [
                $setting->key => [
                    'label' => $setting->label,
                    'amount' => $setting->amount,
                ],
            ]);

        return response()->json([
            'totals' => [
                'total_due' => round($totalDue, 2),
                'total_paid' => round($totalPaid, 2),
                'total_outstanding' => round(max($outstanding, 0), 2),
            ],
            'latest_bills' => BillResource::collection($latestBills),
            'settings' => $settings,
            'currency' => CurrencyHelper::getCurrencyConfig(),
        ]);
    }
}

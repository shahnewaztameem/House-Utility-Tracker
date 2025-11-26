<?php

namespace App\Actions\Billing;

use App\Enums\BillShareStatus;
use App\Enums\BillStatus;
use App\Models\Bill;
use App\Models\BillShare;

class SyncBillMetrics
{
    public static function bill(Bill $bill): void
    {
        $bill->loadMissing('shares');

        $totalDueFromShares = $bill->shares->sum('amount_due');
        $totalPaid = $bill->shares->sum('amount_paid');

        if ($totalDueFromShares > 0) {
            $bill->total_due = $totalDueFromShares;
        }

        $finalTotal = $bill->final_total ?: max($bill->total_due - ($bill->returned_amount ?? 0), 0);
        $bill->final_total = $finalTotal;

        $bill->status = match (true) {
            $finalTotal > 0 && $totalPaid >= $finalTotal => BillStatus::PAID,
            $totalPaid > 0 => BillStatus::PARTIAL,
            default => $bill->status ?? BillStatus::ISSUED,
        };

        $bill->save();

        $bill->shares->each(function (BillShare $share): void {
            $share->status = self::determineShareStatus($share->amount_paid, $share->amount_due);
            $share->save();
        });
    }

    public static function share(BillShare $share): void
    {
        $share->status = self::determineShareStatus($share->amount_paid, $share->amount_due);
        $share->save();

        $bill = $share->relationLoaded('bill') ? $share->bill : $share->bill()->first();

        if ($bill) {
            self::bill($bill);
        }
    }

    protected static function determineShareStatus(float $paid, float $due): BillShareStatus
    {
        return match (true) {
            $due > 0 && $paid >= $due => BillShareStatus::PAID,
            $paid > 0 => BillShareStatus::PARTIAL,
            default => BillShareStatus::PENDING,
        };
    }
}


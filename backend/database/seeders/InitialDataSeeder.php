<?php

namespace Database\Seeders;

use App\Enums\BillShareStatus;
use App\Enums\BillStatus;
use App\Models\Bill;
use App\Models\BillShare;
use App\Models\BillingSetting;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class InitialDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $seedPath = database_path('seeders/house_utility_seed.json');
        $payload = file_exists($seedPath)
            ? json_decode(file_get_contents($seedPath), true)
            : null;

        $superAdmin = User::updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'role' => 'super_admin',
                'email_verified_at' => now(),
            ]
        );

        $admin = User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Building Admin',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'email_verified_at' => now(),
            ]
        );

        $resident = User::updateOrCreate(
            ['email' => 'resident@example.com'],
            [
                'name' => 'Sample Resident',
                'password' => Hash::make('password'),
                'role' => 'resident',
                'email_verified_at' => now(),
            ]
        );

        if (! $payload) {
            return;
        }

        foreach ($payload['base_settings'] as $key => $amount) {
            BillingSetting::updateOrCreate(
                ['key' => $key],
                [
                    'label' => Str::of($key)->headline(),
                    'amount' => $amount ?? 0,
                    'metadata' => ['source' => 'excel_seed'],
                ]
            );
        }

        $charges = collect($payload['bill']['charges'] ?? [])
            ->map(fn ($value, $key) => [
                'key' => $key,
                'label' => Str::of($key)->headline(),
                'amount' => (float) $value,
            ])
            ->values()
            ->all();

        $bill = Bill::updateOrCreate(
            ['reference' => 'BILL-SEED-DEC'],
            [
                'for_month' => $payload['bill']['for_month'] ?? 'December',
                'due_date' => $payload['bill']['due_date'],
                'status' => BillStatus::ISSUED,
                'electricity_units' => $payload['bill']['charges']['electricity_units'] ?? 0,
                'electricity_rate' => $payload['base_settings']['electricity_rate'] ?? 0,
                'electricity_bill' => $payload['bill']['charges']['electricity_bill'] ?? 0,
                'line_items' => $charges,
                'total_due' => $payload['bill']['total'] ?? 0,
                'returned_amount' => $payload['bill']['returned_amount'] ?? 0,
                'final_total' => $payload['bill']['final_total_amount'] ?? 0,
                'notes' => 'Imported from spreadsheet seed',
                'created_by' => $superAdmin->id,
                'updated_by' => $superAdmin->id,
            ]
        );

        $shareAmount = round(($bill->final_total ?? 0) / 2, 2);

        $shares = [
            [
                'user_id' => $admin->id,
                'amount_due' => $shareAmount,
                'amount_paid' => $shareAmount,
                'status' => BillShareStatus::PAID,
                'last_paid_at' => now()->subDays(5),
            ],
            [
                'user_id' => $resident->id,
                'amount_due' => $shareAmount,
                'amount_paid' => 0,
                'status' => BillShareStatus::PENDING,
            ],
        ];

        foreach ($shares as $data) {
            $share = BillShare::updateOrCreate(
                ['bill_id' => $bill->id, 'user_id' => $data['user_id']],
                $data
            );

            if ($share->amount_paid > 0) {
                Payment::updateOrCreate(
                    [
                        'bill_share_id' => $share->id,
                        'recorded_by' => $superAdmin->id,
                    ],
                    [
                        'amount' => $share->amount_paid,
                        'paid_on' => $share->last_paid_at ?? now(),
                        'method' => 'bank',
                        'reference' => 'PAY-SEED-' . $share->id,
                        'notes' => 'Seed payment imported from spreadsheet',
                    ]
                );
            }
        }
    }
}

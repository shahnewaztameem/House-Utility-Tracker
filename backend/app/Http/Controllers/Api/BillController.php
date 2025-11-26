<?php

namespace App\Http\Controllers\Api;

use App\Actions\Billing\SyncBillMetrics;
use App\Enums\BillStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBillRequest;
use App\Http\Requests\UpdateBillRequest;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\BillingSetting;
use App\Models\User;
use App\Services\TelegramService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class BillController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $query = Bill::query()
            ->with(['creator', 'shares.user', 'shares.payments'])
            ->latest();

        if (! $user->isAdmin()) {
            $query->whereHas('shares', fn (Builder $builder) => $builder->where('user_id', $user->id));
        } else {
            if ($request->filled('status')) {
                $query->where('status', $request->string('status')->toString());
            }

            if ($request->filled('for_month')) {
                $query->where('for_month', 'like', '%'.$request->string('for_month')->toString().'%');
            }
        }

        // Default to pagination for better performance
        $perPage = $request->integer('per_page', 15);
        return BillResource::collection(
            $query->paginate($perPage)->withQueryString()
        );
    }

    public function store(StoreBillRequest $request): BillResource
    {
        $user = $request->user();
        $data = $request->validated();

        $bill = DB::transaction(function () use ($data, $user) {
            $lineItems = $this->normalizeLineItems($data['line_items'] ?? []);

            if (empty($lineItems)) {
                $lineItems = $this->lineItemsFromSettings();
            }

            // Calculate electricity bill from start/end units if provided
            if (isset($data['electricity_start_unit']) && isset($data['electricity_end_unit'])) {
                $units = max(0, ($data['electricity_end_unit'] - $data['electricity_start_unit']));
                $data['electricity_units'] = $units;
                // Formula: ((end - start) * 10) / 2
                $data['electricity_bill'] = round(($units * 10) / 2, 2);
            } elseif (
                empty($data['electricity_bill'])
                && ($data['electricity_units'] ?? 0) > 0
                && ($data['electricity_rate'] ?? 0) > 0
            ) {
                // Fallback to old calculation if start/end not provided
                $data['electricity_bill'] = round(
                    ($data['electricity_units'] ?? 0) * ($data['electricity_rate'] ?? 0),
                    2
                );
            }

            $hasElectricityLine = collect($lineItems)->contains(fn ($item) => $item['key'] === 'electricity');

            if (! $hasElectricityLine && ! empty($data['electricity_bill'])) {
                $lineItems[] = [
                    'key' => 'electricity',
                    'label' => 'Electricity',
                    'amount' => (float) $data['electricity_bill'],
                ];
            }

            $totalFromItems = collect($lineItems)->sum('amount');
            $totalDue = $data['total_due'] ?? $totalFromItems;
            $returned = $data['returned_amount'] ?? 0;
            $finalTotal = $data['final_total'] ?? max($totalDue - $returned, 0);

            $billAttributes = [
                'for_month' => $data['for_month'],
                'due_date' => $data['due_date'] ?? null,
                'period_start' => $data['period_start'] ?? null,
                'period_end' => $data['period_end'] ?? null,
                'status' => $data['status'] ?? BillStatus::ISSUED,
                'electricity_units' => $data['electricity_units'] ?? 0,
                'electricity_start_unit' => $data['electricity_start_unit'] ?? null,
                'electricity_end_unit' => $data['electricity_end_unit'] ?? null,
                'electricity_rate' => $data['electricity_rate'] ?? 0,
                'electricity_bill' => $data['electricity_bill'] ?? 0,
                'line_items' => $lineItems,
                'total_due' => $totalDue,
                'returned_amount' => $returned,
                'final_total' => $finalTotal,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ];

            /** @var Bill $bill */
            $bill = Bill::create($billAttributes);

            // Only create shares if they are provided and not empty
            // This prevents auto-creating shares when user explicitly provides empty array
            if (isset($data['shares']) && is_array($data['shares']) && !empty($data['shares'])) {
                $shares = $this->prepareShares($bill, $data['shares']);

                foreach ($shares as $shareData) {
                    $bill->shares()->create($shareData);
                }
            } elseif (!isset($data['shares'])) {
                // Only auto-create shares if shares key is not provided at all (backward compatibility)
                $shares = $this->prepareShares($bill, []);

                foreach ($shares as $shareData) {
                    $bill->shares()->create($shareData);
                }
            }
            // If shares is explicitly empty array, don't create any shares

            SyncBillMetrics::bill($bill->fresh('shares'));

            return $bill->fresh(['shares.user', 'shares.payments']);
        });

        // Send Telegram notifications to all users with shares
        $this->sendBillNotifications($bill);

        return new BillResource($bill);
    }

    public function show(Request $request, Bill $bill): BillResource
    {
        $user = $request->user();
        
        // Ensure user has access to this bill
        $this->ensureBillAccess($user, $bill);
        
        // For residents, only show their own share, not all shares
        if (!$user->isAdmin()) {
            $bill->load(['creator', 'shares' => function ($query) use ($user) {
                $query->where('user_id', $user->id);
            }, 'shares.user', 'shares.payments']);
        } else {
            $bill->load(['creator', 'shares.user', 'shares.payments']);
        }

        return new BillResource($bill);
    }

    public function update(UpdateBillRequest $request, Bill $bill): BillResource
    {
        $data = $request->validated();
        $user = $request->user();

        $bill = DB::transaction(function () use ($bill, $data, $user) {
            $payload = collect($data)->only([
                'for_month',
                'due_date',
                'period_start',
                'period_end',
                'status',
                'electricity_units',
                'electricity_start_unit',
                'electricity_end_unit',
                'electricity_rate',
                'electricity_bill',
                'total_due',
                'returned_amount',
                'final_total',
                'notes',
            ])->filter(fn ($value) => $value !== null);

            // Calculate electricity bill from start/end units if provided
            if ($payload->has('electricity_start_unit') && $payload->has('electricity_end_unit')) {
                $startUnit = $payload->get('electricity_start_unit', $bill->electricity_start_unit ?? 0);
                $endUnit = $payload->get('electricity_end_unit', $bill->electricity_end_unit ?? 0);
                $units = max(0, ($endUnit - $startUnit));
                $payload->put('electricity_units', $units);
                // Formula: ((end - start) * 10) / 2
                $payload->put('electricity_bill', round(($units * 10) / 2, 2));
            } elseif ($payload->has('electricity_units') || $payload->has('electricity_rate')) {
                $units = $payload->get('electricity_units', $bill->electricity_units);
                $rate = $payload->get('electricity_rate', $bill->electricity_rate);
                $payload->put('electricity_bill', round($units * $rate, 2));
            }

            if (array_key_exists('line_items', $data)) {
                $payload['line_items'] = $this->normalizeLineItems($data['line_items'] ?? []);
            }

            if (! $payload->has('total_due') && isset($payload['line_items'])) {
                $payload['total_due'] = collect($payload['line_items'])->sum('amount');
            }

            if (! $payload->has('final_total') && ($payload->has('total_due') || $payload->has('returned_amount'))) {
                $payload['final_total'] = max(
                    ($payload['total_due'] ?? $bill->total_due) - ($payload['returned_amount'] ?? $bill->returned_amount),
                    0
                );
            }

            if ($payload->isNotEmpty()) {
                $payload['updated_by'] = $user->id;
                $bill->update($payload->all());
            }

            if (array_key_exists('shares', $data)) {
                $bill->shares()->delete();
                $shares = $this->prepareShares($bill->fresh(), $data['shares'] ?? []);

                foreach ($shares as $share) {
                    $bill->shares()->create($share);
                }
            }

            SyncBillMetrics::bill($bill->fresh('shares'));

            return $bill->fresh(['shares.user', 'shares.payments']);
        });

        return new BillResource($bill);
    }

    public function destroy(Bill $bill): JsonResponse
    {
        $bill->delete();

        return response()->json(['message' => 'Bill deleted successfully.']);
    }

    /**
     * Get available months and years for bill creation.
     */
    public function getMonthYearOptions(Request $request): JsonResponse
    {
        $months = [
            ['value' => 'January', 'label' => 'January'],
            ['value' => 'February', 'label' => 'February'],
            ['value' => 'March', 'label' => 'March'],
            ['value' => 'April', 'label' => 'April'],
            ['value' => 'May', 'label' => 'May'],
            ['value' => 'June', 'label' => 'June'],
            ['value' => 'July', 'label' => 'July'],
            ['value' => 'August', 'label' => 'August'],
            ['value' => 'September', 'label' => 'September'],
            ['value' => 'October', 'label' => 'October'],
            ['value' => 'November', 'label' => 'November'],
            ['value' => 'December', 'label' => 'December'],
        ];

        // Get years from existing bills, or generate from current year ± 2 years
        $currentYear = (int) date('Y');
        $yearsFromBills = Bill::query()
            ->selectRaw('DISTINCT YEAR(created_at) as year')
            ->whereNotNull('created_at')
            ->pluck('year')
            ->filter()
            ->map(fn ($year) => (int) $year)
            ->toArray();

        $years = collect(range($currentYear - 2, $currentYear + 2))
            ->merge($yearsFromBills)
            ->unique()
            ->sort()
            ->reverse()
            ->map(fn ($year) => ['value' => $year, 'label' => (string) $year])
            ->values()
            ->toArray();

        return response()->json([
            'months' => $months,
            'years' => $years,
        ]);
    }

    protected function ensureBillAccess(User $user, Bill $bill): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $hasAccess = $bill->shares()
            ->where('user_id', $user->id)
            ->exists();

        if (! $hasAccess) {
            abort(Response::HTTP_FORBIDDEN, 'You do not have access to this bill.');
        }
    }

    protected function prepareShares(Bill $bill, array $shares): array
    {
        if (empty($shares)) {
            // Only include residents in bill shares
            $users = User::query()
                ->where('role', 'resident')
                ->get();

            $perPerson = $bill->final_total > 0 && $users->count() > 0
                ? round($bill->final_total / $users->count(), 2)
                : 0;

            return $users->map(fn (User $user) => [
                'user_id' => $user->id,
                'amount_due' => $perPerson,
                'amount_paid' => 0,
            ])->toArray();
        }

        // Validate that all shares are for residents only
        $userIds = collect($shares)->pluck('user_id')->unique();
        $nonResidents = User::whereIn('id', $userIds)
            ->where('role', '!=', 'resident')
            ->pluck('id');
        
        if ($nonResidents->isNotEmpty()) {
            abort(Response::HTTP_BAD_REQUEST, 'Bill shares can only be assigned to residents. Admin and super_admin users cannot be assigned to bills.');
        }

        return collect($shares)->map(function (array $share) {
            return [
                'user_id' => $share['user_id'],
                'amount_due' => round((float) $share['amount_due'], 2),
                'amount_paid' => round((float) ($share['amount_paid'] ?? 0), 2),
            ];
        })->toArray();
    }

    protected function normalizeLineItems(array $items): array
    {
        return collect($items)->map(function (array $item) {
            return [
                'key' => $item['key'] ?? '',
                'label' => $item['label'] ?? Str::headline($item['key'] ?? ''),
                'amount' => round((float) ($item['amount'] ?? 0), 2),
            ];
        })->filter(fn (array $item) => ! empty($item['key']) && $item['amount'] > 0)
            ->values()
            ->toArray();
    }

    protected function lineItemsFromSettings(): array
    {
        return BillingSetting::query()
            ->where('amount', '>', 0)
            ->get()
            ->map(fn ($setting) => [
                'key' => $setting->key,
                'label' => $setting->label,
                'amount' => (float) $setting->amount,
            ])
            ->toArray();
    }

    /**
     * Send Telegram notifications to all users with bill shares
     *
     * @param Bill $bill
     * @return void
     */
    protected function sendBillNotifications(Bill $bill): void
    {
        $telegramService = app(TelegramService::class);
        $bill->load(['shares.user']);

        foreach ($bill->shares as $share) {
            $user = $share->user;
            if ($user && $user->telegram_chat_id) {
                // Load the specific share for this user in the message
                $billForUser = $bill->fresh(['shares' => function ($query) use ($user) {
                    $query->where('user_id', $user->id);
                }]);

                $message = $telegramService->formatBillMessage($billForUser);
                $telegramService->sendMessage($user->telegram_chat_id, $message);
            }
        }
    }
}

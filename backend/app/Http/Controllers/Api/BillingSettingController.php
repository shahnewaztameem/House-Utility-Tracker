<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateBillingSettingRequest;
use App\Models\BillingSetting;
use Illuminate\Http\JsonResponse;

class BillingSettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->settingsPayload()]);
    }

    public function update(UpdateBillingSettingRequest $request): JsonResponse
    {
        $settingsPayload = $request->validated()['settings'];

        foreach ($settingsPayload as $item) {
            BillingSetting::updateOrCreate(
                ['key' => $item['key']],
                [
                    'label' => data_get($item, 'metadata.label', $item['key']),
                    'amount' => $item['amount'],
                    'metadata' => $item['metadata'] ?? [],
                ]
            );
        }

        return response()->json([
            'message' => 'Billing settings updated.',
            'data' => $this->settingsPayload(),
        ]);
    }

    protected function settingsPayload()
    {
        return BillingSetting::query()
            ->orderBy('key')
            ->get()
            ->map(fn (BillingSetting $setting) => [
                'id' => $setting->id,
                'key' => $setting->key,
                'label' => $setting->label,
                'amount' => (float) $setting->amount,
                'metadata' => $setting->metadata ?? [],
            ]);
    }
}

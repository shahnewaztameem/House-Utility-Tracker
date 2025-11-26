<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BillShareResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $status = $this->status;
        $statusValue = $status instanceof \UnitEnum ? $status->value : $status;

        return [
            'id' => $this->id,
            'bill_id' => $this->bill_id,
            'bill' => $this->whenLoaded('bill', fn () => [
                'id' => $this->bill?->id,
                'reference' => $this->bill?->reference,
                'for_month' => $this->bill?->for_month,
                'due_date' => optional($this->bill?->due_date)->toDateString(),
                'status' => $this->bill?->status?->value ?? $this->bill?->status,
            ]),
            'user' => [
                'id' => $this->user?->id,
                'name' => $this->user?->name,
                'role' => $this->user?->role?->value ?? $this->user?->role,
            ],
            'status' => $statusValue,
            'amount_due' => (float) $this->amount_due,
            'amount_paid' => (float) $this->amount_paid,
            'outstanding' => (float) max(($this->amount_due - $this->amount_paid), 0),
            'last_paid_at' => optional($this->last_paid_at)->toIso8601String(),
            'notes' => $this->notes,
            'payments' => PaymentResource::collection(
                $this->whenLoaded('payments')
            ),
        ];
    }
}

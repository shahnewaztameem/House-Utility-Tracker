<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'bill_share_id' => $this->bill_share_id,
            'amount' => (float) $this->amount,
            'paid_on' => optional($this->paid_on)->toDateString(),
            'method' => $this->method,
            'reference' => $this->reference,
            'notes' => $this->notes,
            'recorded_by' => $this->whenLoaded('recordedBy', fn () => [
                'id' => $this->recordedBy?->id,
                'name' => $this->recordedBy?->name,
            ]),
            'bill_share' => $this->whenLoaded('billShare', fn () => [
                'id' => $this->billShare?->id,
                'user_id' => $this->billShare?->user_id,
                'bill_id' => $this->billShare?->bill_id,
                'bill' => $this->billShare?->bill
                    ? [
                        'id' => $this->billShare?->bill?->id,
                        'reference' => $this->billShare?->bill?->reference,
                        'for_month' => $this->billShare?->bill?->for_month,
                    ]
                    : null,
            ]),
        ];
    }
}

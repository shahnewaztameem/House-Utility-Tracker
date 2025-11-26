<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BillResource extends JsonResource
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
            'reference' => $this->reference,
            'for_month' => $this->for_month,
            'status' => $this->status?->value ?? $this->status,
            'due_date' => optional($this->due_date)->toDateString(),
            'period_start' => optional($this->period_start)->toDateString(),
            'period_end' => optional($this->period_end)->toDateString(),
            'electricity_units' => $this->electricity_units,
            'electricity_start_unit' => $this->electricity_start_unit,
            'electricity_end_unit' => $this->electricity_end_unit,
            'electricity_rate' => (float) $this->electricity_rate,
            'electricity_bill' => (float) $this->electricity_bill,
            'line_items' => $this->line_items ?? [],
            'total_due' => (float) $this->total_due,
            'returned_amount' => (float) $this->returned_amount,
            'final_total' => (float) $this->final_total,
            'notes' => $this->notes,
            'created_by' => [
                'id' => $this->creator?->id,
                'name' => $this->creator?->name,
            ],
            'shares' => BillShareResource::collection(
                $this->whenLoaded('shares')
            ),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ElectricityReadingResource extends JsonResource
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
            'month' => $this->month,
            'year' => $this->year,
            'start_unit' => (int) $this->start_unit,
            'end_unit' => $this->end_unit !== null ? (int) $this->end_unit : null,
            'recorded_by' => $this->whenLoaded('recorder', fn () => [
                'id' => $this->recorder?->id,
                'name' => $this->recorder?->name,
            ]),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}

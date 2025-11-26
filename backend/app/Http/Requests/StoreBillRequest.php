<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBillRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'for_month' => ['required', 'string', 'max:100'],
            'due_date' => ['nullable', 'date'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date', 'after_or_equal:period_start'],
            'status' => ['nullable', 'in:draft,issued,partial,paid,overdue'],
            'electricity_units' => ['nullable', 'integer', 'min:0'],
            'electricity_start_unit' => ['nullable', 'integer', 'min:0'],
            'electricity_end_unit' => ['nullable', 'integer', 'min:0', 'gte:electricity_start_unit'],
            'electricity_rate' => ['nullable', 'numeric', 'min:0'],
            'electricity_bill' => ['nullable', 'numeric', 'min:0'],
            'line_items' => ['nullable', 'array'],
            'line_items.*.key' => ['required_with:line_items', 'string'],
            'line_items.*.label' => ['nullable', 'string'],
            'line_items.*.amount' => ['required_with:line_items', 'numeric', 'min:0'],
            'total_due' => ['nullable', 'numeric', 'min:0'],
            'returned_amount' => ['nullable', 'numeric', 'min:0'],
            'final_total' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
            'shares' => ['nullable', 'array'],
            'shares.*.user_id' => ['required_with:shares', 'exists:users,id'],
            'shares.*.amount_due' => ['required_with:shares', 'numeric', 'min:0'],
        ];
    }
}

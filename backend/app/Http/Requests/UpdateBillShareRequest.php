<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBillShareRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount_due' => ['sometimes', 'numeric', 'min:0'],
            'amount_paid' => ['sometimes', 'numeric', 'min:0'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}


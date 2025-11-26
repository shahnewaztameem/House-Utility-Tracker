<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBillShareRequest extends FormRequest
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
            'bill_id' => ['required', 'exists:bills,id'],
            'user_id' => [
                'required',
                'exists:users,id',
                function ($attribute, $value, $fail) {
                    $user = \App\Models\User::find($value);
                    if ($user && $user->role !== 'resident') {
                        $fail('Bill shares can only be assigned to residents. Admin and super_admin users cannot be assigned to bills.');
                    }
                },
            ],
            'amount_due' => ['required', 'numeric', 'min:0'],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:pending,partial,paid'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}

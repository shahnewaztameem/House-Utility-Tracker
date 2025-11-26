<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $role = $this->role;
        $roleValue = $role instanceof \UnitEnum ? $role->value : $role;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $roleValue,
            'role_label' => method_exists($role, 'label') ? $role->label() : ucfirst(str_replace('_', ' ', (string) $roleValue)),
            'email_verified_at' => optional($this->email_verified_at)->toIso8601String(),
            'last_login_at' => optional($this->last_login_at)->toIso8601String(),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'abilities' => [
                'manage_bills' => $this->isAdmin(),
                'manage_settings' => $this->isSuperAdmin(),
                'view_all_records' => $this->isAdmin(),
            ],
        ];
    }
}

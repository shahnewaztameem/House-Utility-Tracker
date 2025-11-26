<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = User::query()->orderBy('name');

        if ($request->filled('role')) {
            $query->forRole($request->string('role')->toString());
        }

        if ($request->boolean('residents_only')) {
            $query->forRole('resident');
        }

        if ($request->boolean('paginate')) {
            return UserResource::collection(
                $query->paginate($request->integer('per_page', 15))->withQueryString()
            );
        }

        return UserResource::collection($query->get());
    }

    public function store(Request $request): UserResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', 'in:super_admin,admin,resident'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => bcrypt($data['password']),
            'role' => $data['role'],
        ]);

        return new UserResource($user);
    }

    public function update(Request $request, User $user): UserResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'password' => ['sometimes', 'string', 'min:8'],
            'role' => ['sometimes', 'string', 'in:super_admin,admin,resident'],
            'abilities' => ['sometimes', 'array'],
            'telegram_chat_id' => ['sometimes', 'nullable', 'string'],
        ]);

        if (isset($data['password'])) {
            $data['password'] = bcrypt($data['password']);
        }

        $user->update($data);

        return new UserResource($user->fresh());
    }
}


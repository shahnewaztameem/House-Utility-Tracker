<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(Response::HTTP_UNAUTHORIZED, 'Unauthenticated.');
        }

        if (empty($roles)) {
            return $next($request);
        }

        $roleValues = array_map(
            fn ($role) => Role::fromString($role)->value,
            $roles
        );

        if (! in_array($user->role->value ?? $user->role, $roleValues, true)) {
            abort(Response::HTTP_FORBIDDEN, 'You are not allowed to perform this action.');
        }

        return $next($request);
    }
}

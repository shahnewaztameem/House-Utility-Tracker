<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // Fetch all active menu items with children, ordered by order field
        $menuItems = MenuItem::active()
            ->rootItems()
            ->with(['children' => function ($query) {
                $query->active()->orderBy('order');
            }])
            ->orderBy('order')
            ->get();

        // Transform to array format and filter based on permissions
        $transformedItems = $menuItems->map(function ($item) use ($user) {
            return $this->transformMenuItem($item, $user);
        })->filter()->values()->toArray();

        return response()->json([
            'data' => $transformedItems,
        ]);
    }

    private function transformMenuItem(MenuItem $item, $user): ?array
    {
        // Check if item is active
        if (!$item->active) {
            return null;
        }

        // Check required ability
        if ($item->required_ability) {
            $hasAbility = match ($item->required_ability) {
                'manage_bills' => $user->isAdmin(),
                'manage_settings' => $user->isSuperAdmin(),
                'view_all_records' => $user->isAdmin(),
                default => false,
            };

            if (!$hasAbility) {
                return null;
            }
        }

        // Check required role
        if ($item->required_role) {
            $roleHierarchy = [
                'super_admin' => 3,
                'admin' => 2,
                'resident' => 1,
            ];

            $userRoleLevel = $roleHierarchy[$user->role->value ?? $user->role] ?? 0;
            $requiredRoleLevel = $roleHierarchy[$item->required_role] ?? 0;

            if ($userRoleLevel < $requiredRoleLevel) {
                return null;
            }
        }

        $result = [
            'key' => $item->key,
            'label' => $item->label,
            'icon' => $item->icon,
            'path' => $item->path,
            'active' => $item->active,
            'required_ability' => $item->required_ability,
            'required_role' => $item->required_role,
        ];

        // Process children
        if ($item->children->isNotEmpty()) {
            $children = $item->children->map(function ($child) use ($user) {
                return $this->transformMenuItem($child, $user);
            })->filter()->values()->toArray();

            if (empty($children)) {
                // If no children are accessible, don't show parent
                return null;
            }

            $result['children'] = $children;
        }

        return $result;
    }

    public function checkRoute(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $path = $request->input('path');

        if (!$path) {
            return response()->json(['accessible' => false, 'message' => 'Path is required'], 400);
        }

        // Find menu item by exact path match first (check all items, not just root)
        $menuItem = MenuItem::where('path', $path)->first();

        // If not found, try to find by matching base route (for dynamic routes like /bills/123)
        if (!$menuItem) {
            // Extract base path (e.g., /bills/123/edit -> /bills)
            $pathParts = explode('/', trim($path, '/'));
            if (count($pathParts) > 0) {
                $basePath = '/' . $pathParts[0];
                $menuItem = MenuItem::where('path', $basePath)->first();
            }
        }

        // If still not found, try to find by key (for routes like /bills/[id] which might have key /bills)
        if (!$menuItem) {
            $pathParts = explode('/', trim($path, '/'));
            if (count($pathParts) > 0) {
                $baseKey = '/' . $pathParts[0];
                $menuItem = MenuItem::where('key', $baseKey)->first();
            }
        }

        // Also check for nested routes (e.g., /config/users)
        if (!$menuItem && strpos($path, '/config/') === 0) {
            $pathParts = explode('/', trim($path, '/'));
            if (count($pathParts) >= 2) {
                $fullPath = '/' . $pathParts[0] . '/' . $pathParts[1];
                $menuItem = MenuItem::where('path', $fullPath)->first();
            }
        }

        if (!$menuItem) {
            // If no menu item found for this path, allow access (might be a dynamic route not in menu)
            // But you can change this to false if you want to restrict to only menu-defined routes
            return response()->json([
                'accessible' => true,
                'message' => 'Route not found in menu items',
            ]);
        }

        // Check if item is active
        if (!$menuItem->active) {
            return response()->json([
                'accessible' => false,
                'message' => 'This route is currently disabled',
            ]);
        }

        // Check required ability
        if ($menuItem->required_ability) {
            $hasAbility = match ($menuItem->required_ability) {
                'manage_bills' => $user->isAdmin(),
                'manage_settings' => $user->isSuperAdmin(),
                'view_all_records' => $user->isAdmin(),
                default => false,
            };

            if (!$hasAbility) {
                return response()->json([
                    'accessible' => false,
                    'message' => 'You don\'t have the required permission',
                ]);
            }
        }

        // Check required role
        if ($menuItem->required_role) {
            $roleHierarchy = [
                'super_admin' => 3,
                'admin' => 2,
                'resident' => 1,
            ];

            $userRoleLevel = $roleHierarchy[$user->role->value ?? $user->role] ?? 0;
            $requiredRoleLevel = $roleHierarchy[$menuItem->required_role] ?? 0;

            if ($userRoleLevel < $requiredRoleLevel) {
                return response()->json([
                    'accessible' => false,
                    'message' => 'You don\'t have the required role',
                ]);
            }
        }

        return response()->json([
            'accessible' => true,
            'message' => 'Route is accessible',
        ]);
    }
}


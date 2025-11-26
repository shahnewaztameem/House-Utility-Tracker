<?php

namespace Database\Seeders;

use App\Models\MenuItem;
use Illuminate\Database\Seeder;

class MenuItemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Clear existing menu items
        MenuItem::truncate();

        $menuItems = [
            [
                'key' => '/dashboard',
                'label' => 'Overview',
                'icon' => 'DashboardOutlined',
                'path' => '/dashboard',
                'active' => true,
                'required_ability' => null,
                'required_role' => null,
                'order' => 1,
                'children' => [],
            ],
            [
                'key' => '/bills',
                'label' => 'Bills',
                'icon' => 'FileTextOutlined',
                'path' => '/bills',
                'active' => true,
                'required_ability' => null,
                'required_role' => null,
                'order' => 2,
                'children' => [],
            ],
            [
                'key' => '/shares',
                'label' => 'Shares & Payments',
                'icon' => 'TeamOutlined',
                'path' => '/shares',
                'active' => true,
                'required_ability' => null,
                'required_role' => null,
                'order' => 3,
                'children' => [],
            ],
            [
                'key' => '/manage-bills',
                'label' => 'Manage Bills',
                'icon' => 'DollarOutlined',
                'path' => '/manage-bills',
                'active' => true,
                'required_ability' => 'manage_bills',
                'required_role' => null,
                'order' => 4,
                'children' => [],
            ],
            [
                'key' => '/config',
                'label' => 'Config',
                'icon' => 'ControlOutlined',
                'path' => null,
                'active' => true,
                'required_ability' => 'manage_settings',
                'required_role' => null,
                'order' => 5,
                'children' => [
                    [
                        'key' => '/config/users',
                        'label' => 'User Management',
                        'icon' => 'UsergroupAddOutlined',
                        'path' => '/config/users',
                        'active' => true,
                        'required_ability' => 'manage_settings',
                        'required_role' => null,
                        'order' => 1,
                    ],
                    [
                        'key' => '/config/electricity',
                        'label' => 'Electricity Units',
                        'icon' => 'ThunderboltOutlined',
                        'path' => '/config/electricity',
                        'active' => true,
                        'required_ability' => 'manage_settings',
                        'required_role' => null,
                        'order' => 2,
                    ],
                    [
                        'key' => '/config/settings',
                        'label' => 'Billing Settings',
                        'icon' => 'SettingOutlined',
                        'path' => '/config/settings',
                        'active' => true,
                        'required_ability' => 'manage_settings',
                        'required_role' => null,
                        'order' => 3,
                    ],
                ],
            ],
        ];

        foreach ($menuItems as $itemData) {
            $children = $itemData['children'];
            unset($itemData['children']);

            $parent = MenuItem::create($itemData);

            foreach ($children as $childData) {
                $childData['parent_id'] = $parent->id;
                MenuItem::create($childData);
            }
        }
    }
}


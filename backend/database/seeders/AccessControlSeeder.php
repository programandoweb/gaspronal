<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AccessControlSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'dashboard.view',
            'catalog.view', 'catalog.manage',
            'content.view', 'content.manage',
            'heroes.view', 'heroes.manage',
            'agents.view', 'agents.manage',
            'ai.view', 'ai.manage',
            'channels.view', 'channels.manage',
            'extensions.view', 'extensions.manage',
            'commercial.quotes.view', 'commercial.quotes.manage',
            'commercial.appointments.view', 'commercial.appointments.manage',
            'seo.view', 'seo.manage',
            'deployments.view', 'deployments.manage',
            'security.users.view', 'security.users.manage',
            'security.roles.view', 'security.roles.manage',
        ];

        foreach ($permissions as $name) {
            Permission::findOrCreate($name, 'api');
        }

        $root = Role::findOrCreate('root', 'api');
        $admin = Role::findOrCreate('admin', 'api');
        Role::findOrCreate('cliente', 'api');

        $allPermissions = Permission::where('guard_name', 'api')->get();
        $root->syncPermissions($allPermissions);

        $adminDefaults = $allPermissions->reject(
            fn (Permission $permission) => in_array($permission->name, ['heroes.view', 'heroes.manage'], true)
        );

        if ($admin->permissions()->count() === 0) {
            $admin->syncPermissions($adminDefaults);
        } else {
            $admin->givePermissionTo($adminDefaults);
        }

        $rootUser = User::query()->firstOrCreate(
            ['email' => 'lic.jorgemendez@gmail.com'],
            [
                'name' => 'Jorge Méndez',
                'password' => Hash::make(Str::password(48)),
            ],
        );
        $rootUser->syncRoles([$root]);

        foreach ([
            ['name' => 'Claudio Gallego Ruiz', 'email' => 'cgallegoruiz2000@gmail.com'],
            ['name' => 'Cristina', 'email' => 'servicioalcliente@gaspronal.com'],
        ] as $account) {
            $user = User::query()->firstOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => Hash::make(Str::password(48)),
                ],
            );

            $user->syncRoles([$admin]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}

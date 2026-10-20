<?php

namespace Tests\Feature;

use App\Domain\ServiceOrders\Enums\ServiceOrderStatus;
use App\Domain\ServiceOrders\Services\ServiceOrderWorkflow;
use App\Models\{ServiceCustomer,ServiceOrder,User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ServiceOrdersTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $email): User
    {
        return User::query()->create(['name' => $email, 'email' => $email, 'password' => Hash::make('password')]);
    }

    private function permission(User $user, string ...$permissions): void
    {
        foreach ($permissions as $permission) Permission::findOrCreate($permission, 'api');
        $user->givePermissionTo($permissions);
    }

    public function test_order_requires_customer_and_uses_an_atomic_unique_number(): void
    {
        $admin = $this->user('admin@example.test'); $this->permission($admin, 'service_orders.create');
        $customer = ServiceCustomer::query()->create(['name' => 'Industria Test']);
        $this->actingAs($admin, 'api')->postJson('/api/v1/service-orders', [
            'customer_id' => $customer->id, 'maintenance_type' => 'Preventivo', 'description' => 'Revisión', 'service_location' => 'Pereira', 'contact_name' => 'Ana',
        ])->assertCreated()->assertJsonPath('data.status', 'pending');
        $this->assertDatabaseHas('service_orders', ['number' => 'OS-'.now('America/Bogota')->format('Y').'-000001']);
    }

    public function test_customer_cannot_access_another_customer_order(): void
    {
        $clientRole = Role::findOrCreate('cliente', 'api');
        $first = $this->user('one@example.test'); $first->assignRole($clientRole);
        $second = $this->user('two@example.test'); $second->assignRole($clientRole);
        $firstCustomer = ServiceCustomer::query()->create(['name' => 'Uno', 'user_id' => $first->id]);
        $secondCustomer = ServiceCustomer::query()->create(['name' => 'Dos', 'user_id' => $second->id]);
        $order = ServiceOrder::query()->create(['number' => 'OS-2026-000001', 'customer_id' => $secondCustomer->id, 'status' => ServiceOrderStatus::Closed, 'maintenance_type' => 'Correctivo', 'description' => 'x', 'service_location' => 'x', 'contact_name' => 'x', 'customer_snapshot' => []]);
        $this->actingAs($first, 'api')->getJson('/api/v1/service-orders/'.$order->id)->assertForbidden();
    }

    public function test_closed_order_cannot_be_modified(): void
    {
        $admin = $this->user('manager@example.test'); $this->permission($admin, 'service_orders.manage');
        $customer = ServiceCustomer::query()->create(['name' => 'Cliente']);
        $order = ServiceOrder::query()->create(['number' => 'OS-2026-000002', 'customer_id' => $customer->id, 'status' => ServiceOrderStatus::Closed, 'maintenance_type' => 'Correctivo', 'description' => 'x', 'service_location' => 'x', 'contact_name' => 'x', 'customer_snapshot' => []]);
        $this->actingAs($admin, 'api')->patchJson('/api/v1/service-orders/'.$order->id, ['description' => 'No permitido'])->assertUnprocessable();
    }
}

<?php

namespace App\Domain\ServiceOrders\Enums;

enum ServiceOrderStatus: string
{
    case Pending = 'pending'; case Assigned = 'assigned'; case InProgress = 'in_progress'; case Completed = 'completed'; case Closed = 'closed';
    public function label(): string { return match ($this) { self::Pending => 'Pendiente', self::Assigned => 'Asignada', self::InProgress => 'En ejecución', self::Completed => 'Finalizada', self::Closed => 'Cerrada' }; }
}

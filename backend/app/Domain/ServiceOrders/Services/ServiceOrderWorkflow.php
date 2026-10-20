<?php

namespace App\Domain\ServiceOrders\Services;

use App\Domain\ServiceOrders\Enums\ServiceOrderStatus;
use App\Models\{ServiceCustomer,ServiceOrder,User};
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB,Storage};
use Illuminate\Support\Str;

class ServiceOrderWorkflow
{
    public function create(array $data, User $actor): ServiceOrder
    {
        return DB::transaction(function () use ($data, $actor): ServiceOrder {
            $customer = ServiceCustomer::query()->findOrFail($data['customer_id']);
            $order = ServiceOrder::query()->create([
                ...$data,
                'number' => 'PENDING-'.Str::uuid(),
                'status' => ServiceOrderStatus::Pending,
                'customer_snapshot' => $this->customerSnapshot($customer, $data),
            ]);
            // El ID autoincremental es asignado bajo bloqueo de fila por MariaDB: no depende de MAX().
            $order->update(['number' => sprintf('OS-%s-%06d', now('America/Bogota')->format('Y'), $order->id)]);
            $this->event($order, $actor, 'created', ['status' => ServiceOrderStatus::Pending->value]);
            return $order->fresh();
        });
    }

    public function assign(ServiceOrder $order, array $userIds, User $actor): ServiceOrder
    {
        $this->assertOpen($order);
        abort_unless(in_array($order->status, [ServiceOrderStatus::Pending, ServiceOrderStatus::Assigned], true), 422, 'Solo se puede reasignar antes de iniciar la ejecución.');
        return DB::transaction(function () use ($order, $userIds, $actor): ServiceOrder {
            $validIds = User::query()->whereIn('id', $userIds)->pluck('id')->all();
            abort_if(count($validIds) !== count(array_unique($userIds)), 422, 'Uno o más técnicos no existen.');
            $order->assignments()->delete();
            foreach ($validIds as $id) $order->assignments()->create(['user_id' => $id, 'assigned_by' => $actor->id]);
            $order->update(['status' => ServiceOrderStatus::Assigned]);
            $this->event($order, $actor, 'assigned', ['user_ids' => $validIds]);
            return $order->fresh();
        });
    }

    public function start(ServiceOrder $order, User $actor): ServiceOrder
    {
        $this->assertAssignedTechnician($order, $actor);
        abort_unless($order->status === ServiceOrderStatus::Assigned, 422, 'La orden debe estar asignada para iniciar.');
        $order->update(['status' => ServiceOrderStatus::InProgress, 'started_at' => now()]);
        $this->event($order, $actor, 'started'); return $order->fresh();
    }

    public function complete(ServiceOrder $order, User $actor): ServiceOrder
    {
        $this->assertAssignedTechnician($order, $actor);
        abort_unless($order->status === ServiceOrderStatus::InProgress, 422, 'La orden debe estar en ejecución.');
        abort_unless($order->activities()->exists(), 422, 'Registra al menos una actividad antes de finalizar.');
        abort_unless($order->evidences()->exists(), 422, 'Registra al menos una evidencia antes de finalizar.');
        abort_unless($order->activities()->whereNotNull('arrived_at')->whereNotNull('departed_at')->exists(), 422, 'Registra hora de llegada y salida.');
        $order->update(['status' => ServiceOrderStatus::Completed, 'completed_at' => now()]);
        $this->event($order, $actor, 'completed'); return $order->fresh();
    }

    public function storeEvidence(ServiceOrder $order, UploadedFile $file, string $kind, User $actor): void
    {
        $this->assertAssignedTechnician($order, $actor); $this->assertOpen($order);
        abort_unless($order->status === ServiceOrderStatus::InProgress, 422, 'Solo puedes cargar evidencias durante la ejecución.');
        abort_unless(in_array($kind, ['before','during','after'], true), 422, 'Clasificación de evidencia inválida.');
        $path = $file->storeAs('service-orders/'.$order->id.'/evidences', Str::uuid().'.'.$file->extension(), 'local');
        $order->evidences()->create(['uploaded_by'=>$actor->id, 'kind'=>$kind, 'path'=>$path, 'mime'=>$file->getMimeType(), 'size'=>$file->getSize(), 'metadata'=>['original_name'=>$file->getClientOriginalName()]]);
        $this->event($order, $actor, 'evidence_uploaded', ['kind'=>$kind]);
    }

    public function sign(ServiceOrder $order, array $data, User $actor): void
    {
        $this->assertOpen($order);
        abort_unless($order->status === ServiceOrderStatus::Completed, 422, 'La orden debe estar finalizada antes de firmar.');
        if ($data['role'] === 'technician') $this->assertAssignedTechnician($order, $actor);
        if ($data['role'] === 'customer') {
            if ($actor->hasRole('cliente')) abort_unless($order->customer->user_id === $actor->id, 403);
            else $this->assertAssignedTechnician($order, $actor);
        }
        $encoded = preg_replace('#^data:image/png;base64,#', '', $data['signature']);
        $binary = base64_decode((string) $encoded, true); abort_if($binary === false || strlen($binary) > 1024 * 1024, 422, 'Firma inválida o demasiado grande.');
        $path = 'service-orders/'.$order->id.'/signatures/'.Str::uuid().'.png'; Storage::disk('local')->put($path, $binary);
        $order->signatures()->updateOrCreate(['role'=>$data['role']], ['user_id'=>$data['role']==='technician'?$actor->id:($order->customer->user_id === $actor->id?$actor->id:null), 'signer_name'=>$data['signer_name'], 'path'=>$path, 'accepted'=>true, 'ip_address'=>request()->ip(), 'signed_at'=>now()]);
        $this->event($order, $actor, 'signed', ['role'=>$data['role'], 'signer_name'=>$data['signer_name']]);
    }

    public function close(ServiceOrder $order, User $actor): ServiceOrder
    {
        $this->assertOpen($order); abort_unless($order->status === ServiceOrderStatus::Completed, 422, 'La orden debe estar finalizada para cerrarla.');
        abort_unless($order->signatures()->where('role','technician')->where('accepted',true)->exists() && $order->signatures()->where('role','customer')->where('accepted',true)->exists(), 422, 'Se requieren las firmas del técnico y del cliente.');
        return DB::transaction(function () use ($order, $actor): ServiceOrder {
            $order->load(['customer','assignments.user','activities','equipments','materials','evidences','signatures']);
            $path = 'service-orders/'.$order->id.'/closed/'.Str::uuid().'.pdf';
            $pdf = $this->pdf($order); Storage::disk('local')->put($path, $pdf);
            $order->update(['status'=>ServiceOrderStatus::Closed,'closed_at'=>now(),'closed_by'=>$actor->id,'closed_pdf_path'=>$path,'closed_pdf_hash'=>hash('sha256',$pdf),'execution_snapshot'=>$order->toArray()]);
            $this->event($order, $actor, 'closed', ['pdf_hash'=>hash('sha256',$pdf)]); return $order->fresh();
        });
    }

    public function event(ServiceOrder $order, ?User $actor, string $event, array $payload=[]): void { $order->events()->create(['actor_id'=>$actor?->id,'event'=>$event,'payload'=>$payload,'created_at'=>now()]); }
    private function assertOpen(ServiceOrder $order): void { abort_if($order->closed(), 422, 'La orden cerrada es inmutable.'); }
    private function assertAssignedTechnician(ServiceOrder $order, User $user): void { abort_unless($user->getAllPermissions()->contains('name', 'service_orders.manage') || $order->assignments()->where('user_id',$user->id)->exists(), 403, 'No estás asignado a esta orden.'); }
    private function customerSnapshot(ServiceCustomer $customer, array $data): array { return ['name'=>$customer->name,'document'=>$customer->document,'email'=>$customer->email,'phone'=>$customer->phone,'whatsapp'=>$customer->whatsapp,'address'=>$data['service_location']]; }
    private function pdf(ServiceOrder $order): string
    {
        $text = implode("\n", ['GASPRONAL · ORDEN DE SERVICIO', $order->number, 'Cliente: '.$order->customer_snapshot['name'], 'Ubicación: '.$order->service_location, 'Tipo: '.$order->maintenance_type, 'Descripción: '.preg_replace('/\s+/', ' ', $order->description), 'Cerrada: '.now('America/Bogota')->format('Y-m-d H:i'), 'Firmas: '.$order->signatures->pluck('signer_name')->implode(' · ')]);
        $safe = str_replace(['\\','(',')',"\r"], ['\\\\','\\(','\\)', ''], $text); $stream = "BT /F1 11 Tf 52 760 Td 14 TL (".str_replace("\n", ") Tj T* (", $safe).") Tj ET";
        $objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>","<< /Length ".strlen($stream)." >>\nstream\n$stream\nendstream","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]; $pdf="%PDF-1.4\n"; $offsets=[0]; foreach($objects as $i=>$object){$offsets[] = strlen($pdf); $pdf.=($i+1)." 0 obj\n$object\nendobj\n";} $xref=strlen($pdf); $pdf.="xref\n0 ".(count($objects)+1)."\n0000000000 65535 f \n"; for($i=1;$i<=count($objects);$i++)$pdf.=sprintf('%010d 00000 n ',$offsets[$i])."\n"; return $pdf."trailer << /Size ".(count($objects)+1)." /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
    }
}

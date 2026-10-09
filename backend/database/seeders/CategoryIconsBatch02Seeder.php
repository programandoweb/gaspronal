<?php
namespace Database\Seeders;
use App\Models\CmsServiceTopic;

use Illuminate\Database\Seeder;
class CategoryIconsBatch02Seeder extends Seeder {
 public function run():void {
  $folder='images/uploads/iconos-programandoweb';
  $items=[
   ['slug'=>'soldadura-taller','name'=>'Soldadura / taller','file'=>'11-soldadura-taller.png'],
   ['slug'=>'diseno-plano-tecnico','name'=>'Diseño / plano técnico','file'=>'12-diseno-plano-tecnico.png'],
   ['slug'=>'cotizacion','name'=>'Cotización','file'=>'13-cotizacion.png'],
   ['slug'=>'asesoria','name'=>'Asesoría','file'=>'14-asesoria.png'],
   ['slug'=>'whatsapp-contacto','name'=>'WhatsApp / contacto','file'=>'15-whatsapp-contacto.png'],
   ['slug'=>'llamada-telefonica','name'=>'Llamada telefónica','file'=>'16-llamada-telefonica.png'],
   ['slug'=>'correo','name'=>'Correo','file'=>'17-correo.png'],
   ['slug'=>'agenda-programacion','name'=>'Agenda / programación','file'=>'18-agenda-programacion.png'],
   ['slug'=>'entrega','name'=>'Entrega','file'=>'19-entrega.png'],
   ['slug'=>'garantia-respaldo','name'=>'Garantía / respaldo','file'=>'20-garantia-respaldo.png'],
  ];

  foreach($items as $item) {
   $topic=CmsServiceTopic::query()->firstOrCreate(['slug'=>$item['slug']],['name'=>$item['name'],'is_active'=>true]);
   if (!is_file(public_path($folder.'/'.$item['file']))) {
    $this->command?->warn('Pendiente: '.$item['file']); continue;
   }
   $topic->update(['image_url'=>'/'.$folder.'/'.$item['file']]);
  }
 }
}

<?php
namespace Database\Seeders;
use App\Models\CmsServiceTopic;
use App\Models\CatalogCategory;
use Illuminate\Database\Seeder;
class CategoryIconsBatch01Seeder extends Seeder {
 public function run():void {
  $folder='images/uploads/iconos-programandoweb';
  $items=[
   ['slug'=>'mantenimiento-preventivo','name'=>'Mantenimiento preventivo','file'=>'01-mantenimiento-preventivo.png'],
   ['slug'=>'reparacion','name'=>'Reparación','file'=>'02-reparacion.png'],
   ['slug'=>'instalacion','name'=>'Instalación','file'=>'03-instalacion.png'],
   ['slug'=>'diagnostico-tecnico','name'=>'Diagnóstico técnico','file'=>'04-diagnostico-tecnico.png'],
   ['slug'=>'fabricacion-a-medida','name'=>'Fabricación a medida','file'=>'05-fabricacion-a-medida.png'],
   ['slug'=>'redes-de-gas','name'=>'Redes de gas','file'=>'06-redes-de-gas.png'],
   ['slug'=>'extraccion','name'=>'Extracción','file'=>'07-extraccion.png'],
   ['slug'=>'refrigeracion','name'=>'Refrigeración','file'=>'08-refrigeracion.png'],
   ['slug'=>'equipos-electricos','name'=>'Equipos eléctricos','file'=>'09-equipos-electricos.png'],
   ['slug'=>'acero-inoxidable','name'=>'Acero inoxidable','file'=>'10-acero-inoxidable.png'],
  ];
  // Deshacer exclusivamente las asignaciones incorrectas de la tanda 1 en Productos.
  $productSlugs=['asadores-y-planchas-asadoras','campanas-extractoras','carros-para-comidas-y-bebidas','equipos-bano-maria','equipos-mixtos','estufas-industriales','fabricas-de-arepas','freidoras-de-alto-rendimiento','hornos-industriales','marmitas'];
  foreach($productSlugs as $i=>$slug) {
   $file=$items[$i]['file'];
   CatalogCategory::query()->where('slug',$slug)->where('image_url','/'.$folder.'/'.$file)->update(['image_url'=>null]);
  }

  foreach($items as $item) {
   $topic=CmsServiceTopic::query()->firstOrCreate(['slug'=>$item['slug']],['name'=>$item['name'],'is_active'=>true]);
   if (!is_file(public_path($folder.'/'.$item['file']))) {
    $this->command?->warn('Pendiente: '.$item['file']); continue;
   }
   $topic->update(['image_url'=>'/'.$folder.'/'.$item['file']]);
  }
 }
}

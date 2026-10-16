<?php

namespace Database\Seeders;

use App\Models\AgentKnowledgeEntry;
use Illuminate\Database\Seeder;

/**
 * Conocimiento institucional verificado para el RAG de Claudio.
 * Fuentes: sitio histórico oficial de Gaspronal, preservado durante la migración.
 */
class ClaudioInstitutionalKnowledgeSeeder extends Seeder
{
    public function run(): void
    {
        $entries = [
            [
                'category' => 'empresa',
                'title' => 'Qué es Gaspronal',
                'question' => '¿Qué hace Gaspronal?',
                'answer' => 'Gaspronal Industrias y Servicios S.A.S. atiende necesidades industriales, comerciales y residenciales relacionadas con gas propano, gas natural y equipos para cocina. Su oferta incluye fabricación de equipos industriales, servicios técnicos, redes de gas, extracción industrial y desarrollos especiales a medida.',
                'keywords' => 'empresa gaspronal quienes son que hace industria comercial residencial gas propano natural equipos cocina',
                'source_url' => 'https://www.gaspronal.com/2019/somos-gaspronal',
            ],
            [
                'category' => 'empresa',
                'title' => 'Misión de Gaspronal',
                'question' => '¿Cuál es la misión de Gaspronal?',
                'answer' => 'La misión publicada de Gaspronal es brindar al mercado industrial, comercial y residencial soluciones integrales a tiempo en servicios y productos relacionados con gas propano y natural, apoyadas en trabajo en equipo, responsabilidad, seguridad y respaldo permanente.',
                'keywords' => 'mision propósito soluciones integrales seguridad respaldo servicio',
                'source_url' => 'https://www.gaspronal.com/2019/somos-gaspronal',
            ],
            [
                'category' => 'empresa',
                'title' => 'Visión y valores de Gaspronal',
                'question' => '¿Cuáles son la visión y valores de Gaspronal?',
                'answer' => 'La visión histórica publicada plantea liderazgo regional en soluciones relacionadas con gas propano y natural, con proyección internacional, investigación y desarrollo sostenible. Sus valores declarados son seguridad, responsabilidad, trabajo en equipo y confianza. La visión está fechada para 2025, por lo que no debe presentarse como una meta vigente sin validación adicional.',
                'keywords' => 'vision valores seguridad responsabilidad trabajo equipo confianza 2025',
                'source_url' => 'https://www.gaspronal.com/2019/somos-gaspronal',
            ],
            [
                'category' => 'servicios',
                'title' => 'Servicios de fabricación y proyectos especiales',
                'question' => '¿Gaspronal fabrica equipos a medida?',
                'answer' => 'Sí. Gaspronal fabrica equipos industriales en acero inoxidable para la industria alimenticia y desarrolla equipos especiales a medida. El sitio histórico menciona proyectos para negocios de arepas, panaderías, restaurantes y comidas rápidas. El diseño, las dimensiones, materiales y alcance se validan con el equipo comercial y técnico para cada proyecto.',
                'keywords' => 'fabricación medida especial acero inoxidable equipos industriales restaurantes panaderias arepas comidas rápidas',
                'source_url' => 'https://www.gaspronal.com/2019/servicios/fabricacion-de-equipos-industriales',
            ],
            [
                'category' => 'servicios',
                'title' => 'Servicio técnico de equipos a gas',
                'question' => '¿Gaspronal instala, repara o hace mantenimiento?',
                'answer' => 'Gaspronal ofrece instalación, reparación y mantenimiento preventivo y correctivo de equipos de cocina domésticos e industriales a gas. Para orientar el caso se debe confirmar el tipo de equipo, marca si se conoce, falla o servicio requerido, ubicación y urgencia; el diagnóstico, alcance y valor los valida un asesor humano.',
                'keywords' => 'mantenimiento reparación instalación servicio técnico equipos gas domésticos industriales falla',
                'source_url' => 'https://www.gaspronal.com/2019/servicios/instalacion-reparacion-y-mantenimiento-de-equipos-a-gas-domesticos-e-industriales',
            ],
            [
                'category' => 'servicios',
                'title' => 'Redes de gas y extracción industrial',
                'question' => '¿Gaspronal trabaja redes de gas y extracción?',
                'answer' => 'Gaspronal publica servicios de revisión, reforma, corrección e instalación de redes de gas natural y propano, además de montajes de sistemas de extracción industrial. Cualquier certificación, autorización, visita técnica, viabilidad o alcance debe confirmarse con el equipo responsable antes de comprometerlo al cliente.',
                'keywords' => 'redes gas natural propano extracción campanas montaje certificación instalación reforma revisión',
                'source_url' => 'https://www.gaspronal.com/2019/servicios',
            ],
            [
                'category' => 'catalogo',
                'title' => 'Líneas de producto de Gaspronal',
                'question' => '¿Qué productos vende o fabrica Gaspronal?',
                'answer' => 'El catálogo histórico agrupa carros para comidas y bebidas, equipos mixtos, estufas industriales, hornos industriales, campanas extractoras, equipos baño María, mesas y mesones, marmitas, freidoras de alto rendimiento, fábricas de arepas, asadores y planchas asadoras, y panadería. La disponibilidad, medidas y configuración se verifican en la ficha o con un asesor.',
                'keywords' => 'productos categorias carros comidas bebidas equipos mixtos estufas hornos campanas baño maria mesas marmitas freidoras arepas asadores planchas panaderia',
                'source_url' => 'https://www.gaspronal.com/2019/productos',
            ],
            [
                'category' => 'contacto',
                'title' => 'Sedes, horarios y canales de Gaspronal',
                'question' => '¿Dónde queda Gaspronal y cuál es su horario?',
                'answer' => 'Gaspronal publica una sede en Medellín: Carrera 45 No. 40-61, sector El Palo con Los Huesos, con horario de lunes a viernes de 8:00 a.m. a 5:30 p.m. y sábados de 8:00 a.m. a 1:00 p.m. También publica Almacén Industrial Gaspronal en Caucasia: Carrera 9 No. 22-40, barrio Kennedy, de lunes a viernes de 8:00 a.m. a 12:00 m. y de 2:00 p.m. a 6:00 p.m., sábados de 8:00 a.m. a 2:00 p.m. Contacto publicado: servicioalcliente@gaspronal.com y 304 552 7575. Antes de confirmar una atención presencial, verificar vigencia con el equipo humano.',
                'keywords' => 'sedes dirección ubicación medellín caucasia horario teléfono correo contacto',
                'source_url' => 'https://www.gaspronal.com/2019/contactenos',
            ],
            [
                'category' => 'comercial',
                'title' => 'Cómo se gestiona una cotización',
                'question' => '¿Cómo puedo cotizar con Gaspronal?',
                'answer' => 'Claudio puede recopilar la necesidad y dejarla preparada para el equipo comercial. Para una cotización se recomienda definir producto o servicio, uso, cantidades o capacidad, medidas o espacio cuando aplique, ciudad de entrega o servicio, plazo deseado y observaciones. Un asesor humano valida especificaciones, disponibilidad, visita técnica, condiciones y precio antes de emitir la propuesta.',
                'keywords' => 'cotización cotizar precio propuesta solicitud cantidades medidas ciudad entrega visita técnica',
                'source_url' => 'https://www.gaspronal.com/2019/contactenos',
            ],
        ];

        foreach ($entries as $entry) {
            AgentKnowledgeEntry::query()->firstOrCreate(
                ['agent_id' => 'claudio', 'title' => $entry['title']],
                [...$entry, 'agent_id' => 'claudio', 'source_type' => 'curated', 'confidence' => 100, 'status' => 'published', 'created_by_agent' => 'system'],
            );
        }
    }
}

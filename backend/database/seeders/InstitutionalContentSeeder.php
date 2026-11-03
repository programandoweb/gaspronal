<?php

namespace Database\Seeders;

use App\Models\PageBlock;
use Illuminate\Database\Seeder;

class InstitutionalContentSeeder extends Seeder
{
    public function run(): void
    {
        // Create only when missing: never overwrite changes made in the dashboard.
        PageBlock::query()->firstOrCreate(
            ['page_key' => 'somos-gaspronal', 'block_key' => 'institutional'],
            [
                'label' => 'Misión, visión y valores',
                'sort_order' => 0,
                'is_active' => true,
                'content' => [
                    'bar_text' => 'FABRICACIÓN · SERVICIO TÉCNICO · GAS · EXTRACCIÓN INDUSTRIAL',
                    'hero_kicker' => 'Nuestra identidad',
                    'hero_title' => 'Somos Gaspronal',
                    'hero_description' => 'Gaspronal Industrias y Servicios S.A.S. Soluciones integrales en productos y servicios relacionados con gas propano y natural.',
                    'mission_kicker' => 'Nuestro propósito',
                    'mission_title' => 'Misión',
                    'mission_description' => 'Brindar al mercado industrial, comercial y residencial, soluciones integrales a tiempo en servicios y productos relacionados con gas propano y natural, gracias al compromiso en equipo y a la responsabilidad en los procesos con seguridad y respaldo permanente.',
                    'vision_kicker' => 'Nuestra proyección',
                    'vision_title' => 'Visión',
                    'vision_description' => 'GASPRONAL INDUSTRIAS Y SERVICIOS S.A.S. Para el año 2025, será una empresa líder a nivel regional en soluciones integrales en servicios y productos relacionados con gas propano y natural con proyección a mercados internacionales, gracias a la investigación permanente de aplicaciones que permitan el desarrollo sostenible garantizando una mejor calidad de vida a todos.',
                    'values_kicker' => 'Lo que nos define',
                    'values_title' => 'Valores empresariales',
                    'values_description' => 'Los valores son los crecimientos de la cultura humana y por tanto de la estrategia organización, éstos conforman los principios éticos y el soporte filosófico del ser y el que hacer de la empresa que permiten el logro de los objetivos gracias a la productividad, la calidad y el compromiso de satisfacción de sus clientes y del equipo de trabajo.',
                    'safety_title' => 'Seguridad',
                    'safety_description' => 'Cuidando su vida y su inversión como si fuera la nuestra.',
                    'responsibility_title' => 'Responsabilidad',
                    'responsibility_description' => 'Siendo coherentes con el pensar, el decir y el actuar, gracias a la transparencia, el respeto y el respaldo en la gestión.',
                    'teamwork_title' => 'Trabajo en equipo',
                    'teamwork_description' => 'Comprometidos con un propósito común, "El servicio al cliente".',
                    'trust_title' => 'Confianza',
                    'trust_description' => 'Reconociendo la importancia de satisfacer su necesidad a tiempo con un serio compromiso.',
                    'cta_title' => '¿Cómo podemos ayudarte?',
                    'cta_description' => 'Conoce nuestras soluciones o conversa con un asesor.',
                    'cta_products' => 'Ver productos',
                    'cta_advice' => 'Solicitar asesoría',
                ],
            ],
        );
    }
}

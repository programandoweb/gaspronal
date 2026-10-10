# Marca de agua y redes sociales

Nuevas cargas de catálogo, categorías, notas y heroes e imágenes persistidas por Jorge, Leonardo y Lucía pasan por ImageWatermarkService. Logo oficial centrado, opacidad 20 %, dimensiones máximas 50 % del lienzo, conservando proporciones y sin ampliar el logo. Se conserva formato JPG/PNG/WebP y dimensiones. No se reprocesan imágenes existentes ni URLs externas guardadas directamente.

Logo disponible en backend sin dependencia de Next.js. Docker habilita GD con WebP: reconstruir backend al desplegar.

Facebook e Instagram extraídos de https://www.gaspronal.com/ el 10 de octubre de 2026. Componente accesible compartido en barra superior y footer del inicio.

Typecheck frontend y ESLint de archivos modificados aprobados (advertencias previas de imports sin uso). Prueba backend agregada: php artisan test --filter=ImageWatermarkServiceTest. Su ejecución requiere PHP/GD y dependencias Laravel.

Validación adicional: build Next.js aprobado; sintaxis PHP de todos los archivos modificados aprobada. Prueba directa GD aprobada para JPG/PNG/WebP: dimensiones, formato, ubicación, opacidad aproximada y rechazo de datos inválidos. PHPUnit Laravel no ejecutado por falta de vendor. QA visual pendiente: navegador Playwright no disponible en este entorno.

# Jorge — mejoramiento de imágenes del catálogo

Este flujo es independiente de la investigación histórica de Jorge y del flujo editorial de Lucía.

## Operación

- El lote automático recorre productos por ID ascendente.
- Se ejecuta con `php artisan agent:jorge:enhance-next`; el scheduler lo invoca cada minuto.
- No necesita Chrome ni Browser Collector.
- La imagen principal actual se envía a Gemini como `inlineData` multimodal.
- La imagen nueva se guarda en `storage/app/public/catalog/{id}`, se agrega a `gallery` y pasa a `og_image`.
- La imagen anterior permanece en la galería y nunca se sobrescribe.
- El lote automático usa `auto:{catalog_item_id}` como clave idempotente.
- Una regeneración manual crea una nueva clave y conserva todas las versiones anteriores.

## Configuración

Se reutiliza el proveedor central de IA. Debe existir un proveedor activo con `driver=gemini`, credencial `api_key` y un modelo activo cuya capacidad incluya `image` o `image_generation`, o cuyo identificador contenga `image`.

Si no existe un modelo de imagen registrado, se usa el primer proveedor Gemini activo y `GEMINI_IMAGE_MODEL` (por defecto `gemini-3.1-flash-image`).

No se deben exponer claves en el frontend.

## Despliegue

Después de actualizar el código:

```bash
php artisan migrate --force
php artisan schedule:list
php artisan agent:jorge:enhance-next
```

El último comando solo procesa un producto si el lote está en estado `running`.

## Validación recomendada

Antes de ejecutar el catálogo completo, usar uno o dos productos y confirmar:

1. El original permanece en galería.
2. La nueva imagen aparece en galería y queda como principal.
3. Un fallo de Gemini no modifica la principal.
4. Pausa, stop y reanudación conservan el avance.
5. La investigación histórica de Jorge y Lucía siguen sin cambios.

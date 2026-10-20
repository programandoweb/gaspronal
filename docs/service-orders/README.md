# Módulo de órdenes de servicio

## Uso

1. Ejecute migraciones y el seeder `AccessControlSeeder`.
2. Desde **Órdenes de servicio** cree o seleccione un cliente, registre la orden y asigne técnicos.
3. El técnico inicia, registra actividades/evidencias, completa y recoge las dos firmas.
4. Un usuario con permiso de cierre confirma el cierre; se genera el PDF inmutable.

## Despliegue

```bash
cd /var/www/gaspronal.programandoweb.net && git pull && sudo bash scripts/deploy.sh
```

Luego ejecute, si el deploy no los ejecuta: `php artisan migrate --force && php artisan db:seed --class=AccessControlSeeder --force`.

No hay nuevas variables de entorno obligatorias. El almacenamiento usa el disco local privado existente.

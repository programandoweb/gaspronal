# Atención Web de Claudio

El botón público **Hablar con un asesor** abre el chat de Claudio sin exponer el servicio interno de NestJS. El canal se administra en `/dashboard/agentes/claudio` → **Atención Web** y queda desactivado después de aplicar las migraciones.

## Flujo

1. Next.js crea o recupera una sesión mediante su BFF `/api/public/claudio-web/*`.
2. El identificador de sesión se conserva exclusivamente en la cookie HttpOnly `gaspronal_claudio_web_session`; Laravel guarda sólo su hash.
3. Laravel persiste los mensajes en `communication_conversations` y `communication_messages` con `channel=web`, invoca internamente el runtime de Claudio y persiste la respuesta.
4. El runtime aplica las instrucciones de canal web. Las herramientas de registro, cotización, agenda y handoff exigen consentimiento persistente en la conversación; la búsqueda de catálogo web no devuelve precios comerciales privados.

## Despliegue

Ejecutar las migraciones antes de habilitar el canal:

```bash
docker compose exec backend php artisan migrate --force
```

Después, abrir el panel de Claudio, activar **Atención Web**, configurar el saludo si se desea y guardar. `AGENT_SHARED_SECRET` y `REALTIME_INTERNAL_URL` ya son requisitos existentes del runtime; no se agregan variables públicas ni secretos `NEXT_PUBLIC_*`.

## Validación manual

- Con el canal desactivado, abrir el widget no debe consumir el modelo.
- Con el canal activado, enviar una consulta desde dos navegadores y verificar que el historial no se cruza.
- Solicitar una cotización sin consentir datos: Claudio debe explicar la finalidad y no registrar información.
- Confirmar que el listado de Atención Web no muestra conversaciones de WhatsApp.

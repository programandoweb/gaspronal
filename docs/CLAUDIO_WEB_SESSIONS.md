# Sesiones privadas de Claudio Web (16-10-2026)

## Implementación inicial
- El proxy Next.js `/api/public/claudio-web/[action]` ya no usa la cookie compartida `gaspronal_claudio_web_session`.
- Cada navegador conserva un UUID, token opaco de sesión y última conversación en IndexedDB, base `gaspronal-claudio-web-v1`.
- Cada solicitud `current`, `message` y `consent` exige `X-Claudio-Web-Session`; Laravel valida su SHA-256 y caducidad.
- Los endpoints públicos deben responder `Cache-Control: private, no-store` para impedir mezclas entre visitantes.
- El botón Nueva conversación crea una sesión nueva, sin reutilizar un token anterior.
- MariaDB continúa siendo la fuente de verdad; IndexedDB es únicamente una copia local.

## Pendientes antes de dar por terminada la identidad omnicanal
1. Persistir formalmente `browser_id` en MariaDB y asociarlo a sesiones con restricciones e índices, sin tomar el UUID como prueba de identidad.
2. Incorporar flujo PIN/OTP de WhatsApp verificado y consentimiento para enlazar diferentes dispositivos con el mismo contacto.
3. Resolver el contacto por número normalizado E.164, enlazar conversaciones de forma transaccional, aplicar autorización al historial y pasar contexto limitado a Claudio.
4. Diseñar historial de múltiples sesiones y sincronización local; por ahora solo se cachea la conversación activa.
5. Probar aislamiento con navegadores distintos, modo incógnito, expiración/revocación de tokens, cachés, despliegue en producción y pruebas de regresión.
6. Para visitantes que ya tenían cookie, el cambio inicia una nueva sesión privada; no se deben recuperar conversaciones previas sin identificación verificada.

## Despliegue
```bash
cd /var/www/gaspronal.programandoweb.net && git pull && sudo bash scripts/deploy.sh
```

No declarar completado el enlace entre dispositivos sin pruebas de PIN/OTP y autorización en backend.

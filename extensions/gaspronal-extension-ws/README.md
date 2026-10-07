# Gaspronal WhatsApp IA

Extensión Chrome Manifest V3 para WhatsApp Web conectada directamente al runtime NestJS de Gaspronal.

## Contrato preservado

No se cambiaron los eventos Socket.IO existentes:

- `lm.request`
- `lm.cancel`
- `lm.accepted`
- `lm.started`
- `lm.completed`
- `lm.error`
- `enterprise.registration.turn`

Tampoco se renombraron los mensajes internos `MIGO_WA_AI_*`, selectores `migo-wa-*` ni las claves históricas de storage, para conservar compatibilidad con el código probado de la extensión.

## Configuración

- URL Realtime Gaspronal: URL pública del servicio `realtime`.
- Token de inferencia: debe coincidir con `INFERENCE_CLIENT_TOKEN` del realtime.
- Agent ID: se conserva en el payload por compatibilidad; Gaspronal lo refleja en los eventos pero no lo usa para enrutar.
- Contexto: se conserva por compatibilidad.
- LM Studio NO se consume desde Chrome. NestJS hace el proxy hacia `LM_STUDIO_BASE_URL`, cuyo valor por defecto en Gaspronal es `http://10.8.0.2:1234`.

## Seguridad

El token no viene pregrabado en el paquete. Debe configurarse al instalar la extensión.

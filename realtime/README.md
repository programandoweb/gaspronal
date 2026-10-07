# Gaspronal Realtime & Agent Runtime

Servicio NestJS del monorepo Gaspronal para comunicación en tiempo real con agentes.

## Agentes iniciales

- Cristina
- Jorge
- Claudio

Las definiciones viven en `realtime/agents/<id>/`. Por ahora solo están creados; sus responsabilidades se definirán después.

## Socket.IO (canal principal)

Namespace:

```text
/agents
```

Eventos:

- `agent:list`: solicita/lista los agentes disponibles.
- `agent:message`: envía `{ "agentId": "cristina", "message": "..." }`.
- `agent:response`: respuesta del agente.
- `agent:error`: error de protocolo o autorización.

Si `AGENT_SHARED_SECRET` está configurado, conectar con:

```js
io("/agents", { auth: { token: "..." } })
```

## REST JSON (fallback)

```http
GET  /health
GET  /api/agents
POST /api/agents/:id/messages
Content-Type: application/json

{"message":"Hola","requestId":"opcional"}
```

Cuando `AGENT_SHARED_SECRET` está configurado, REST usa `Authorization: Bearer <secret>`.

## Desarrollo

```bash
npm install
npm run start:dev
```

Puerto por defecto: `4100`.

## Extensión WhatsApp -> LM Studio directo

Gaspronal expone en el namespace raíz de Socket.IO el mismo contrato que utiliza la extensión WhatsApp existente. No se renombraron eventos ni payloads.

Autenticación de la extensión:

```js
io(REALTIME_URL, {
  transports: ["websocket"],
  upgrade: false,
  auth: {
    type: "inference-client",
    token: INFERENCE_CLIENT_TOKEN,
    clientId: "gaspronal-wa-extension"
  }
})
```

Eventos preservados:

- `lm.request`
- `lm.cancel`
- `lm.accepted`
- `lm.started`
- `lm.completed`
- `lm.error`
- `enterprise.registration.turn` se conserva por compatibilidad; Gaspronal responde explícitamente que ese flujo no está habilitado.

NestJS realiza el proxy directamente a LM Studio usando:

```env
LM_STUDIO_BASE_URL=http://10.8.0.2:1234
INFERENCE_CLIENT_TOKEN=CHANGE_ME
LM_STUDIO_REQUEST_TIMEOUT_MS=120000
LM_STUDIO_MAX_BODY_BYTES=2097152
```

Rutas LM Studio permitidas:

- `GET /api/v1/models`
- `POST /api/v1/chat`
- `GET /v1/models`
- `POST /v1/chat/completions`

El campo `migo_context_id` que la extensión histórica incluye en el body se acepta para mantener compatibilidad, pero se elimina antes de enviar la petición a LM Studio. El `contextId` superior y el `agentId` también se aceptan y se reflejan en la respuesta sin utilizarlos para enrutar a Migo.


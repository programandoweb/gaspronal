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

## Integración oficial en Gaspronal

Esta carpeta es la fuente versionada de la extensión dentro del monorepo. El ZIP distribuible debe generarse desde este contenido; no mantener una copia funcional distinta fuera de `extensions/gaspronal-extension-ws`.

Arquitectura operativa:

```text
WhatsApp Web
  -> gaspronal-extension-ws
  -> Socket.IO realtime Gaspronal
  -> LmStudioProxyService
  -> LM Studio (LM_STUDIO_BASE_URL)
```

La extensión no consume Migo ni `migo-monitor-suite`. Los identificadores `MIGO_WA_AI_*`, `migo-wa-*`, `migo_context_id` y otros nombres `migo_*` permanecen únicamente por compatibilidad con el código histórico probado.

### Observaciones registradas

- El `manifest.json` Gaspronal usa versión `1.0.0`; `VALIDACION.txt` conservaba la referencia histórica `0.33.1` de la base de la extensión.
- `enterprise.registration.turn` sigue existiendo porque forma parte del contrato, pero Gaspronal lo mantiene deshabilitado actualmente.
- Existe un número de operador hardcodeado en la lógica heredada de registro empresarial. No debe tratarse como fuente de verdad comercial y debe eliminarse/reemplazarse cuando se implemente un flujo empresarial propio de Gaspronal.
- Los permisos de host siguen siendo amplios porque el código histórico puede descargar medios desde orígenes variables. No ampliarlos y reducirlos cuando el contrato de medios permita una allowlist.
- Este bridge de inferencia no persiste por sí solo las conversaciones en `communication_conversations`. Si la extensión se convierte en canal CRM oficial, la persistencia debe integrarse antes de considerarla equivalente a Baileys/Claudio.

Las reglas normativas completas están en `Agent.md`, sección **Extensión WhatsApp Web administrada por Gaspronal y bridge directo a LM Studio**.

## Integración oficial en Gaspronal

Esta carpeta es la fuente versionada de la extensión dentro del monorepo. El ZIP distribuible debe generarse desde este contenido; no mantener una copia funcional distinta fuera de `extensions/gaspronal-extension-ws`.

Arquitectura operativa:

```text
WhatsApp Web
  -> gaspronal-extension-ws
  -> Socket.IO realtime Gaspronal
  -> LmStudioProxyService
  -> LM Studio
```

La extensión no consume Migo ni `migo-monitor-suite`. Los identificadores `MIGO_WA_AI_*`, `migo-wa-*`, `migo_context_id` y otros nombres `migo_*` permanecen únicamente por compatibilidad con el código histórico probado.

### Observaciones registradas

- El `manifest.json` Gaspronal usa versión `1.0.0`; `VALIDACION.txt` conservaba la referencia histórica `0.33.1` de la base de la extensión.
- `enterprise.registration.turn` sigue existiendo porque forma parte del contrato, pero Gaspronal lo mantiene deshabilitado actualmente.
- Existe un número de operador hardcodeado en la lógica heredada de registro empresarial. No debe tratarse como fuente de verdad comercial y debe eliminarse/reemplazarse cuando se implemente un flujo empresarial propio de Gaspronal.
- Los permisos de host siguen siendo amplios porque el código histórico puede descargar medios desde orígenes variables. No ampliarlos y reducirlos cuando el contrato de medios permita una allowlist.
- Este bridge de inferencia no persiste por sí solo las conversaciones en `communication_conversations`. Si la extensión se convierte en canal CRM oficial, la persistencia debe integrarse antes de considerarla equivalente a Baileys/Claudio.

Las reglas normativas completas están en `Agent.md`, sección **Extensión WhatsApp Web administrada por Gaspronal y bridge directo a LM Studio**.


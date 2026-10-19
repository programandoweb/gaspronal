# WhatsApp por agente — vinculación Baileys

## Implementación
- En `/dashboard/agentes/{id}`, el bloque WhatsApp permite crear un canal, conectar, visualizar QR y desconectar.
- `communication_providers.settings.agent_id` identifica el agente al que corresponde la sesión.
- Baileys conserva su autenticación en el volumen existente; el código no modifica el directorio de sesiones.
- El webhook interno atribuye la conversación al agente asignado y NestJS ejecuta el mismo runtime de modelos, herramientas y prompts que utiliza el agente en el dashboard.
- Los registros y estados internos de conversaciones admiten agentes distintos de Claudio; la interfaz de atención humana existente continúa siendo específica de Claudio.
- Proveedores Baileys históricos sin agent_id se mantienen asociados a Claudio.
- Desvincular desde la ficha elimina las credenciales de WhatsApp (logout:true) y desactiva la reconexión automática hasta conectar nuevamente.
- Los mensajes entrantes pueden usar identificadores `@lid`, que no son teléfonos. NestJS conserva el JID original para responder con Baileys, registra `contact_phone=null` cuando no existe un PN verificado y evita vincular usuarios por números deducidos del LID.
- El envío humano desde el dashboard utiliza `external_thread_id` (identidad real del chat) en lugar del campo de teléfono opcional. El envío manual sigue aceptando números internacionales.
- `sent` indica que Baileys devolvió un identificador de mensaje; no certifica entrega al teléfono del cliente. La confirmación de entrega requiere procesar recibos/ACK.

## Voz entrante: la persona envía audio y Claudio responde texto

El pipeline parte del STT probado en `ivoolveFlow`, pero sin TTS: las notas de voz `audioMessage.ptt` que recibe Baileys se descargan únicamente de chats individuales, se transcriben y siguen el mismo historial y herramientas comerciales.

1. Antes de descargar se rechaza audio de más de **60 segundos** o **4 MiB**; se aplica deduplicación temporal y máximo diez audios por conversación cada diez minutos.
2. La descarga sucede en memoria, con límite; FFmpeg convierte a MP3 mono 16 kHz, sin archivos temporales ni URLs públicas. El servicio STT de Gemini transcribe en español (`es-CO`).
3. El texto se envía por el endpoint interno `receiveInbound` a Laravel; `communication_messages` conserva la transcripción con metadatos `input_mode=voice`. Claudio responde exclusivamente en **texto** usando el JID de WhatsApp que recibió el mensaje; funciona también con `@lid`.
4. Una transcripción **no autoriza** registros de clientes, cotizaciones, citas ni escalamiento. Las operaciones `register_customer`, `create_quote`, `create_appointment`, `handoff_to_human` no se ejecutan en el turno de voz: requieren confirmación posterior por escrito.
5. Si no hay clave, falla Gemini/FFmpeg, llega silencio o excede un límite, se avisa por **texto**. No se guarda el audio ni se incluye en logs.

**Configuración:** utiliza la clave del proveedor Gemini configurado en Claudio, o `GEMINI_STT_API_KEY` en `.env.docker` para transcripción independiente. El modelo de transcripción es `GEMINI_STT_MODEL=gemini-2.5-flash` de forma predeterminada; no altera el modelo de chat. Para suspender notas de voz sin afectar mensajes normales, configurar `WHATSAPP_VOICE_ENABLED=false` y reconstruir `realtime`. El Dockerfile instala FFmpeg en el contenedor de producción. El procesamiento de audios por Gemini debe figurar en el aviso de privacidad.

**QA antes de considerar terminada la integración en producción:** compilar y ejecutar `cd realtime && npm run typecheck && npm run test:channels`; probar audios breves, silencio, audio >60 segundos, repetidos, distintos JID, y comprobar transcripción en la bandeja y respuesta únicamente de texto. El despliegue y estas pruebas reales requieren el VPS.

## Despliegue
```bash
cd /var/www/gaspronal.programandoweb.net && git pull origin main && sudo bash scripts/deploy.sh
```

## QA manual obligatoria
1. Ejecutar builds de Next y NestJS y verificar sintaxis PHP; comprobar los healthchecks.
2. Crear canal desde la ficha de un agente diferente de Claudio; conectar; escanear el QR.
3. Confirmar que la línea conectada corresponde al agente y que una conversación de prueba recibe una respuesta con su identidad.
4. Confirmar persistencia, mensajes salientes, desconexión/reconexión y sesión guardada.
5. Repetir con Claudio y verificar que el canal antiguo continúa funcionando.
6. Verificar que un canal sin permisos no se puede crear y que el dashboard nunca muestra credenciales sensibles.
7. Validar que las conversaciones de WhatsApp no puedan compartir historiales entre números.
8. Probar respuestas que invoquen herramientas particulares: no todas las herramientas comerciales de Claudio aplican a los demás agentes.

## Limitaciones actuales
- Se usa el mismo **motor** de agente, no una identidad de conversación unificada web↔WhatsApp. La vinculación entre sesiones web anónimas y WhatsApp requiere identidad verificada y consentimiento.
- La bandeja humana del dashboard continúa siendo específica de Claudio. La gestión humana multagente requiere una ampliación adicional.
- Se reciben mensajes de texto y notas de voz; Claudio responde siempre por texto. No se incluye reconocimiento de imágenes ni documentos.
- Sin acceso al runtime VPS no se puede afirmar que el QR, Baileys y la entrega funcionan en producción.

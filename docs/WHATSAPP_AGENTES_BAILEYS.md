# WhatsApp por agente — vinculación Baileys

## Implementación
- En `/dashboard/agentes/{id}`, el bloque WhatsApp permite crear un canal, conectar, visualizar QR y desconectar.
- `communication_providers.settings.agent_id` identifica el agente al que corresponde la sesión.
- Baileys conserva su autenticación en el volumen existente; el código no modifica el directorio de sesiones.
- El webhook interno atribuye la conversación al agente asignado y NestJS ejecuta el mismo runtime de modelos, herramientas y prompts que utiliza el agente en el dashboard.
- Los registros y estados internos de conversaciones admiten agentes distintos de Claudio; la interfaz de atención humana existente continúa siendo específica de Claudio.
- Proveedores Baileys históricos sin agent_id se mantienen asociados a Claudio.
- Desconectar desde la ficha no elimina las credenciales de WhatsApp (logout:false).

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
- El envío/recepción está disponible sólo para mensajes de texto soportados en el flujo existente. No se ha añadido soporte nuevo para notas de voz, imágenes ni documentos.
- Sin acceso al runtime VPS no se puede afirmar que el QR, Baileys y la entrega funcionan en producción.

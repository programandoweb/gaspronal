# Claudio Trainer — Manual técnico y QA

## Estado
Implementación de código publicada en main el 16 de octubre de 2026. El despliegue en VPS y las pruebas reales siguen siendo pasos operativos separados.

## Componentes
- Laravel: `ClaudioTrainingController`, endpoints de sesión/propuesta/aprobación/rollback bajo `/api/v1/agents/claudio/training`.
- MariaDB: `agent_training_sessions`, `agent_training_messages`, `agent_training_proposals`, `agent_training_rules`, `agent_training_versions`.
- NestJS: `AgentRuntimeService` utiliza `context.trainingMode` sólo para generar borradores JSON sin herramientas y carga reglas activas desde `internalCredentials` en cada turno.
- Next.js: `ClaudioAdminChatDrawer` muestra interruptor para quien tenga permiso `agents.train` y `ClaudioTrainingPanel` permite confirmar propuestas, ver versiones y restaurarlas.

## Seguridad
- `agents.train` y `agents.training.approve` se asignan inicialmente sólo a root. Los mensajes de clientes nunca llevan la bandera de entrenamiento.
- Una respuesta del modelo **nunca modifica reglas**: únicamente el endpoint de aprobación autenticado crea una versión activa.
- `append` preserva las reglas existentes de la misma categoría; `replace` debe solicitarse explícitamente y aprobarse.
- Las políticas del agente (herramientas, privacidad, precios, consentimiento, seguridad) prevalecen sobre preferencias dinámicas.
- Sólo se entrena comportamiento y procedimientos; generar código, cambiar infraestructura o realizar despliegues requiere otro flujo supervisado.

## QA recomendado
```bash
cd /var/www/gaspronal.programandoweb.net
docker compose --env-file .env.docker exec -T backend php artisan route:list --path=agents/claudio/training
docker compose --env-file .env.docker exec -T backend php artisan migrate:status
docker compose --env-file .env.docker exec -T frontend sh -lc 'cd /app && (npm run typecheck || true)'
docker compose --env-file .env.docker exec -T realtime sh -lc 'cd /app && (npm run typecheck || true)'
```
Las dos últimas líneas son diagnósticas, **no** se deben interpretar como tests superados: los contenedores de producción pueden no incluir TypeScript ni dependencias de desarrollo. Para validar correctamente, ejecutar `npm install && npm run typecheck && npm run build` desde un checkout de cada subproyecto.

Prueba funcional: abrir Claudio como root, activar Entrenamiento, enseñar regla de saludos, aprobarla, desactivar el modo y verificar que la siguiente respuesta comercial aplique la nueva regla. Abrir otra sesión y comprobar que se mantiene. Ejecutar rollback y repetir.

## Despliegue estándar
```bash
cd /var/www/gaspronal.programandoweb.net && git pull && sudo bash scripts/deploy.sh
```
El script actual incluye migraciones/seeders y reconstruye backend, realtime y frontend. Revisar logs y status/health al finalizar.

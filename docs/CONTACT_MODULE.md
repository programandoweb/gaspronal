# Módulo independiente de contacto (Gaspronal)

## Función
La sección #contacto del Home incluye un formulario responsive equivalente al formulario histórico de /2019/contactenos: nombre, apellido, correo, teléfono, motivo y mensaje. Registra consentimiento y contiene un honeypot.

La ruta del dashboard es /dashboard/contactos. Tiene tabs:
- Mensajes: búsqueda, paginación, filtro por lectura/fallo, visualización en drawer, estado de notificación y reintentos.
- Configuración: lista editable de hasta diez correos separados por líneas, comas o punto y coma.

## Flujo
1. El navegador envía POST /api/public/contact al proxy de Next.js.
2. Next.js reenvía a POST /api/v1/public/contact de Laravel.
3. Laravel valida, limita envíos por identidad, y guarda primero el contacto en contact_messages de MariaDB.
4. Laravel lee contact_settings y envía copia por el transporte de Mail configurado (SMTP cuando está activo).
5. Guarda el estado sent, failed, logged o not_configured. El dashboard siempre conserva el mensaje.
6. La acción de reenvío permite volver a intentar la entrega con los destinatarios vigentes.

Se requieren migraciones y seeder ContactSettingsSeeder. El seeder configura por defecto servicioalcliente@gaspronal.com únicamente si no existe configuración previa; no sobrescribe ajustes posteriores.

Se crearon permisos contacts.view y contacts.manage para root y administradores mediante el seeder de permisos existente. Se exige autenticación JWT y permisos en el backend para la consola.

### Importante: SMTP

El valor por defecto de backend/.env.example es MAIL_MAILER=log. En ese modo NO se envían emails: el estado será logged y la copia quedará registrada solo en logs y BD. Para entrega real se debe configurar MAIL_MAILER=smtp con host, puerto y credenciales apropiados en backend/.env del VPS.

Ningún correo del visitante se envía de nuevo desde el navegador. No se utiliza endpoint público para leer los mensajes. No se incluyen secretos SMTP en el repositorio.

## Validación
- Ejecutar migraciones y seeders del proyecto.
- Revisar /dashboard/contactos, tab Configuración.
- Enviar un mensaje de prueba desde /#contacto y confirmar su registro.
- Verificar estado de email y la llegada a cada dirección (con SMTP operativo).
- Probar reenvío de una notificación fallida y confirmar permisos.

Comando de despliegue oficial:

    cd /var/www/gaspronal.programandoweb.net && git pull && sudo bash scripts/deploy.sh

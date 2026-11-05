# Feed Instagram de Gaspronal

El Home presenta hasta seis publicaciones recientes del feed de @gaspronal justo antes del mapa. Se muestran fotos, reels y carruseles, no Stories.

## Configuración en el dashboard

Se administra desde /dashboard/configuracion, tarjeta Instagram · Feed del Home, con acceso mediante permisos instagram.view e instagram.manage.

- Client ID / App ID: ID numérico de la aplicación Meta, distinto del ID de usuario de Instagram.
- Instagram User ID: ID numérico de la cuenta profesional @gaspronal usado por la ruta /media.
- Tipo de autenticación: Facebook Login (graph.facebook.com) o Instagram Login (graph.instagram.com), según el token emitido.
- Access Token: secreto con permisos de lectura de contenido del perfil profesional, almacenado cifrado por Laravel mediante APP_KEY. Nunca se devuelve en GET; se puede actualizar y dejar en blanco para conservar el existente.

La cuenta debe ser profesional (Business o Creator). Los permisos exigidos por Meta dependen del tipo de login y de la versión de su API; deben revisarse en el panel Meta.

## Datos y seguridad

Las configuraciones se almacenan en la tabla instagram_settings con un registro singleton. El backend valida el tipo de host y el ID numérico, cifra el token y responde solamente valores públicos y has_token. No hay endpoint público de credenciales.

El Home consulta GET /api/v1/public/instagram/feed, que devuelve solo las publicaciones normalizadas. Laravel consulta Meta Graph API v25.0 usando Bearer token desde el servidor y mantiene los medios en caché durante 300 segundos. Guardar una configuración invalida esa caché, sin reiniciar el frontend.

Cada tarjeta enlaza al post original. Cuando Meta no responde o las credenciales faltan, se muestra una invitación a visitar el perfil sin inventar contenido.

## Compatibilidad con .env

Si todavía no existe un registro en instagram_settings, se continúan usando las variables del despliegue anterior como fallback:

    INSTAGRAM_CLIENT_ID=
    INSTAGRAM_IG_USER_ID=
    INSTAGRAM_ACCESS_TOKEN=
    INSTAGRAM_GRAPH_HOST=graph.facebook.com

Si el formulario muestra configuración procedente de .env, al guardarla por primera vez debe proporcionarse el token para migrarla a MariaDB. Al existir registro en base de datos, ese registro tiene prioridad. Los valores privados de entorno NO llevan prefijo NEXT_PUBLIC_.

Para aplicar el módulo por primera vez se necesita desplegar la migración y el backend. Los ajustes futuros desde el dashboard no requieren desplegar.

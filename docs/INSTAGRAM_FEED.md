# Feed Instagram de Gaspronal

El Home presenta hasta seis publicaciones recientes del feed de @gaspronal justo antes del mapa. Se muestran fotos, reels y carruseles. NO se muestran Stories.

## Activación

La API oficial de Meta requiere una cuenta profesional (Business o Creator), un ID numérico de cuenta y un token autorizado. NO se usa scraping y NO se versionan secretos.

Configurar en el VPS, archivo .env.docker:

    INSTAGRAM_IG_USER_ID=ID_NUMERICO
    INSTAGRAM_ACCESS_TOKEN=TOKEN_PRIVADO
    INSTAGRAM_GRAPH_HOST=graph.facebook.com

Para Facebook Login, asociar la cuenta profesional de Instagram a una página de Facebook y autorizar los permisos instagram_basic y pages_read_engagement según Meta. Para Instagram Login, utilizar graph.instagram.com y los permisos de lectura correspondientes (instagram_business_basic). Revisar los permisos vigentes en el panel Meta.

Docker inyecta las variables al contenedor frontend solamente en el servidor. No deben llevar el prefijo NEXT_PUBLIC_. Tras configurar, desplegar o recrear el contenedor frontend.

## Comportamiento

- Consulta Meta Graph API v25.0, endpoint de media del usuario, con revalidación de 300 segundos.
- Admite IMAGE, VIDEO, CAROUSEL_ALBUM, excluye STORY. Selecciona hasta seis posts por fecha más reciente.
- Muestra el thumbnail de reels y la portada del carrusel, cuando Meta devuelve esos campos.
- Cada tarjeta enlaza al permalink oficial del post en Instagram.
- Si faltan credenciales, caduca el token o Meta falla, la web no se rompe: muestra una invitación al Instagram sin contenido inventado.
- No se crean tablas, seeders ni flujos de publicación de contenido.

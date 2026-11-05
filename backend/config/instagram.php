<?php

return [
    // Compatibilidad con la configuración previa en .env.
    // Una vez configurado desde el dashboard, prevalece MariaDB.
    'client_id' => env('INSTAGRAM_CLIENT_ID', ''),
    'instagram_user_id' => env('INSTAGRAM_IG_USER_ID', ''),
    'access_token' => env('INSTAGRAM_ACCESS_TOKEN', ''),
    'graph_host' => env('INSTAGRAM_GRAPH_HOST', 'graph.facebook.com'),
];

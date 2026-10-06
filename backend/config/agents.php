<?php

$sharedSecret = trim((string) env('AGENT_SHARED_SECRET', ''));

if ($sharedSecret === '') {
    $dockerEnv = '/var/www/gaspronal.programandoweb.net/.env.docker';

    if (is_file($dockerEnv)) {
        foreach (file($dockerEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            if (str_starts_with($line, 'AGENT_SHARED_SECRET=')) {
                $sharedSecret = trim(substr($line, strlen('AGENT_SHARED_SECRET=')));
                break;
            }
        }
    }
}

return [
    'shared_secret' => $sharedSecret,
    'realtime_internal_url' => rtrim((string) env('REALTIME_INTERNAL_URL', 'http://realtime:4100'), '/'),
];

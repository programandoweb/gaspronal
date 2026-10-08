<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('gaspronal:status', function (): void {
    $this->info('Gaspronal backend OK');
})->purpose('Verifica que el backend puede iniciar.');

Schedule::command('agent:jorge:research-next')
    ->everyMinute()
    ->withoutOverlapping(10);

Schedule::command('agent:leonardo:enhance-next')
    ->everyMinute()
    ->withoutOverlapping(10);

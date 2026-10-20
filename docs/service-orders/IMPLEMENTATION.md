# Implementación — Órdenes de servicio

## Matriz de integración

| Área existente | Contrato de integración | Aislamiento |
|---|---|---|
| Acceso | JWT `auth:api` + Spatie Permission guard `api` | Se agregan permisos y el rol idempotente `cliente`; no se modifica autenticación. |
| Comercial | `commercial_quotes.id` opcional; `commercial_leads.id` opcional en cliente | Nunca se crea un lead ni se altera una cotización. |
| Usuarios | `users.id` opcional en `service_customers`; técnicos son usuarios asignados | Una cuenta solo se vincula explícitamente por el operador. |
| Archivos | Disco local privado `storage/app/service-orders` | URLs únicamente autenticadas o firmadas temporalmente. |
| Correo/WhatsApp | Laravel Mail y URL firmada temporal | El operador obtiene/autoriza el enlace; no se envía automáticamente. |

## Decisiones verificadas

- No había un modelo de cliente canónico: se crea `service_customers` dentro de este dominio.
- El proyecto usa `spatie/laravel-permission`, por lo que el rol `cliente` y permisos se crean con `findOrCreate` en el seeder existente.
- El proyecto no tiene biblioteca PDF. Se genera un PDF corporativo simple del lado servidor y se guarda inmutablemente al cerrar, evitando una dependencia externa obligatoria.
- El cliente recibe solo `service_orders.view_own`; todas las consultas propias se filtran en el servidor por `user_id` del cliente asociado.

## Secuencia de entrega

1. Migraciones y modelos aditivos, autorización y seeders.
2. Ciclo de vida transaccional, auditoría, evidencias, firmas y PDF.
3. API REST protegida y paneles administrativo, técnico y cliente.
4. Pruebas de autorización, estados y datos mínimos; build y lint.

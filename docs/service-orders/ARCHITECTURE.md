# Arquitectura — Órdenes de servicio

El agregado principal es `ServiceOrder`. Depende obligatoriamente de `ServiceCustomer` y opcionalmente de `CommercialQuote`. Sus hijos son asignaciones, actividades, equipos, materiales, evidencias, firmas y eventos.

Estados permitidos: `pending → assigned → in_progress → completed → closed`. El cierre captura snapshots, genera el PDF y calcula un hash SHA-256 de integridad. Una orden cerrada no admite cambios.

Tablas: `service_customers`, `service_orders`, `service_order_assignments`, `service_order_activities`, `service_order_equipments`, `service_order_materials`, `service_order_evidences`, `service_order_signatures` y `service_order_events`.

API: todas las rutas bajo `/api/v1/service-orders` requieren JWT. Administración usa permisos `service_orders.*`; técnicos solo acceden a asignadas; el rol `cliente` solo accede al endpoint `my-orders` filtrado a su ficha vinculada. Los archivos y PDFs se entregan autenticados; compartir utiliza una URL firmada y temporal.

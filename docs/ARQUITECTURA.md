# Arquitectura objetivo — Gaspronal

## 1. Visión

La arquitectura separa claramente el canal público del sistema administrativo, conservando Laravel/MariaDB como fuente de verdad y Next.js como capa de experiencia pública.

```text
                        ┌─────────────────────────┐
                        │       Navegador         │
                        │ móvil / tablet / desktop│
                        └────────────┬────────────┘
                                     │
                         ┌───────────▼───────────┐
                         │       Next.js         │
                         │ Web pública / PWA     │
                         │ Tailwind CSS          │
                         └───────────┬───────────┘
                                     │ API
                         ┌───────────▼───────────┐
                         │       Laravel         │
                         │ CRM / CMS / Auth      │
                         │ Dashboard restringido │
                         └───────────┬───────────┘
                                     │
                         ┌───────────▼───────────┐
                         │       MariaDB         │
                         └───────────────────────┘
```

## 2. Dominios iniciales

Backend sugerido:

```text
app/Domains/
├── Identity/
├── Access/
├── Catalog/
├── Products/
├── Content/
├── Locations/
├── Leads/
├── Quotes/
├── Analytics/
├── Seo/
└── Settings/
```

No crear carpetas vacías por anticipado. La estructura se incorpora conforme existan casos reales.

## 3. Modelo conceptual mínimo

### Catálogo

- categories
- products
- product_images
- product_specs
- product_relations

### Contenido

- services
- posts
- post_categories
- media

### Comercial

- leads
- lead_events
- quote_requests
- contact_submissions
- whatsapp_clicks
- phone_clicks

### SEO

- seo_metadata
- redirects

### Organización

- locations
- users
- roles / permissions
- audit_events

## 4. Web pública

Rutas objetivo conceptuales:

```text
/
/somos-gaspronal
/servicios
/servicios/{slug}
/productos
/productos/{slug}
/productos/categoria/{slug}
/gaspro-notas
/gaspro-notas/{slug}
/contacto
/sedes/{slug}
```

La ruta definitiva de cada contenido migrado dependerá del mapa SEO. Ninguna URL antigua se retira sin redirección o decisión explícita.

## 5. Dashboard

Zona privada conceptual:

```text
/dashboard
/dashboard/products
/dashboard/categories
/dashboard/services
/dashboard/posts
/dashboard/locations
/dashboard/leads
/dashboard/quotes
/dashboard/analytics
/dashboard/seo
/dashboard/users
```

Laravel debe validar autenticación y autorización para cada operación. Next.js puede ocultar o mostrar controles, pero nunca sustituye la autorización del backend.

## 6. Tailwind y diseño

Los valores corporativos se extraerán del sitio/activos vigentes y se centralizarán como tokens.

La implementación no debe dispersar valores HEX en componentes.

Se debe mantener la paleta base Gaspronal y modernizar:

- contraste;
- tipografía;
- jerarquía;
- espaciado;
- estados;
- navegación;
- composición móvil.

## 7. Estrategia mobile-first

El layout nace para móvil.

Especial atención a:

- header;
- menú;
- buscador;
- categorías;
- filtros;
- grid/listado;
- ficha;
- galería;
- tabla de especificaciones;
- CTA WhatsApp;
- formularios;
- blog;
- mapas/sedes;
- dashboard.

En móvil, los datos técnicos pueden transformarse de tabla a definición/listado cuando mejore lectura. Las acciones frecuentes deben permanecer accesibles y no depender de hover.

## 8. Integraciones

Cada integración externa debe aislarse mediante adapter/service.

Inicialmente:

- WhatsApp;
- Google Maps;
- analítica;
- anti-spam;
- correo.

No acoplar lógica de negocio directamente a SDKs de terceros.

## 9. Observabilidad

Preparar:

- logs estructurados;
- correlation/request id;
- healthcheck;
- registro de errores de integraciones;
- auditoría del dashboard;
- métricas comerciales.

## 10. Extensión WhatsApp Web e inferencia LM Studio

Gaspronal incluye una extensión Chrome oficial en:

```text
extensions/gaspronal-extension-ws
```

Su responsabilidad es interactuar con WhatsApp Web y delegar la inferencia al servicio `realtime` de Gaspronal mediante Socket.IO.

```text
WhatsApp Web
    │
    ▼
gaspronal-extension-ws
    │ Socket.IO autenticado
    ▼
realtime / NestJS
    │
    ▼
LmStudioProxyService
    │ red privada / WireGuard
    ▼
LM Studio
http://10.8.0.2:1234
```

El contrato Socket.IO de la extensión es un contrato de compatibilidad y se mantiene estable:

```text
lm.request
lm.cancel
lm.accepted
lm.started
lm.completed
lm.error
enterprise.registration.turn
```

Los identificadores internos heredados `MIGO_WA_AI_*`, `migo-wa-*` y `migo_*` se conservan únicamente para compatibilidad del cliente Chrome y no representan una dependencia de Migo.

El bridge de inferencia no sustituye el runtime comercial de Claudio ni la persistencia de conversaciones gestionada por Laravel. Si la extensión se promueve a canal CRM oficial, deberá integrarse con `communication_conversations` y `communication_messages` para conservar una única fuente de verdad.


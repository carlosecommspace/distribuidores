# DistribOS

SaaS de gestión operativa para distribuidoras e importadoras venezolanas. MVP funcional con inventario, ventas, clientes, MercadoLibre y catálogo público para WhatsApp.

## Stack

- Next.js 14 (App Router) + TypeScript
- PostgreSQL + Prisma
- NextAuth.js v5 (credentials)
- Tailwind + design system propio
- Radix UI primitives, TanStack Table, Recharts, Zustand
- Cron jobs con `node-cron`
- Anthropic SDK para sugerencias de respuestas ML

## Setup

```bash
# 1. Variables
cp .env.example .env
#   - DATABASE_URL: PostgreSQL local o Railway
#   - NEXTAUTH_SECRET: cualquier string aleatorio largo
#   - ML_CLIENT_ID / ML_CLIENT_SECRET: opcional (OAuth de MercadoLibre)
#   - ANTHROPIC_API_KEY: opcional (sugerencias IA)

# 2. Dependencias
npm install

# 3. Base de datos
npm run db:push        # crea las tablas
npm run db:seed        # carga usuario demo + 20 productos + clientes + ventas

# 4. Dev
npm run dev
# http://localhost:3000   →  login: demo@distribos.app / demo1234
# http://localhost:3000/catalogo/demo  →  catálogo público

# 5. Cron (opcional, en otro proceso)
npm run cron
```

## Módulos

| Ruta | Descripción |
| --- | --- |
| `/` | Dashboard con ventas hoy, stock bajo, preguntas ML, top productos |
| `/inventory` | CRUD de productos + sincronización ML por toggle |
| `/clients` | CRM básico con historial de compras |
| `/sales` | Registrar venta multi-paso, descuenta stock automáticamente |
| `/mercadolibre` | OAuth, estado de items y sync manual |
| `/mercadolibre/questions` | Responder preguntas con sugerencia IA |
| `/whatsapp` | Catálogo público + respuestas rápidas |
| `/analytics` | Métricas, gráficos y reportes |
| `/settings` | Empresa, tasa BCV, ML, WhatsApp, notificaciones |
| `/catalogo/[slug]` | Catálogo público sin auth, mobile-first |

## Notas operativas

- **Tasa BCV**: `lib/bcv.ts` consume `ve.dolarapi.com`. El job `jobs/price-sync.ts` la refresca cada hora y recalcula `priceBs` en todos los productos de usuarios con `autoUpdateRate=true`.
- **MercadoLibre**: OAuth en `/api/ml/auth` → `/api/ml/auth/callback`. Webhook listo en `/api/ml/webhook` (registrar la URL en el panel de desarrolladores de ML). Sync de precio/stock en `/api/ml/sync`.
- **IA**: respuestas sugeridas con `claude-haiku-4-5-20251001`. Si no hay `ANTHROPIC_API_KEY` el endpoint devuelve string vacío.
- **WhatsApp Business API**: solo placeholder en MVP. Catálogo público + respuestas rápidas son la entrega real.

## Diseño

Tokens en `app/globals.css`. Fuentes: Syne (display), DM Sans (UI), DM Mono (números). Acento ámbar `#F5A623` sobre fondo oscuro `#0F0F0F`. Sin gradientes purple/blue, sin Inter/Roboto.

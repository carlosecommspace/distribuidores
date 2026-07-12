# DistribOS — Project Brief

> **Este archivo es el prompt-fuente del proyecto**. Se actualiza cuando cambia algo user-facing (nueva feature, nueva integración, cambio de pricing, cambio de público objetivo). Pegalo entero en Claude o ChatGPT y pedile lo que necesites: pitch deck, copy de landing, guión de demo, FAQ, script de video, propuesta para inversores, one-pager, email de outreach, etc.

---

## 🎯 Uso rápido del archivo

Ejemplos de prompts que funcionan con este brief:

```
Basándote en el brief adjunto, generá un pitch deck de 10 slides para una ronda pre-seed de US$300K. Cada slide con título + 3-4 bullets. Enfoque en Venezuela primero, expansión LatAm después.
```

```
Con el brief adjunto, escribí el copy del hero de la landing (headline + subhead + 3 bullets + CTA). Voz cercana, dirigida a un distribuidor venezolano que hoy trabaja con cuadernos y Excel.
```

```
Usá el brief para armar una FAQ de 12 preguntas que respondan las objeciones típicas de un merchant escéptico. Español venezolano neutro.
```

```
Con el brief, redactá un guión para un video demo de 3 minutos. Estructura: problema (30s), solución (60s), demo de 3 features clave (60s), cierre + CTA (30s).
```

---

## Resumen ejecutivo (TL;DR)

**DistribOS** es un sistema operativo SaaS para distribuidoras y mayoristas venezolanos que hoy operan con Excel, cuadernos y WhatsApp desperdigado. En una sola plataforma les damos: inventario, ventas, cartera de clientes, integración con MercadoLibre, WhatsApp Business con bot de IA, sitio web propio con subdominio, portal para sus clientes, portal para sus vendedores, y una capa de IA que analiza sus datos y les dice qué hacer esta semana.

**Nuestro merchant típico** vende 30–1.000 SKUs, factura US$5K–100K/mes, tiene entre 1 y 10 vendedores en calle, atiende clientes por WhatsApp durante todo el día, y quiere modernizar sin gastar US$20K en un ERP tradicional ni contratar un consultor.

**Modelo**: SaaS, planes desde US$29/mes (básico) hasta US$99/mes (full incluye IA). Margen bruto proyectado ~75%.

---

## 👥 Público objetivo

### Primary persona — El distribuidor mayorista de barrio
- Vende al detal y al mayor (electrodomésticos, alimentos, licores, ferretería, insumos médicos, cosmética, autopartes, etc.)
- 30–1.000 SKUs activos
- 1–10 vendedores en calle o telemarketing
- Factura US$5K–100K/mes
- Recibe pedidos por WhatsApp todo el día
- Usa Excel/cuaderno para llevar inventario y ventas
- Ya vende (o intenta vender) en MercadoLibre
- No tiene sitio web o tiene uno estático que no actualiza
- Tiene entre 25 y 55 años, dueño-operador
- **Ubicación**: Caracas, Valencia, Maracaibo, Maracay, Barquisimeto, Puerto La Cruz, San Cristóbal

### Secondary personas
- **Vendedor de calle** (empleado del merchant) — necesita ver sus clientes asignados, colocar pedidos en su nombre, ver su comisión/ranking
- **Cliente del merchant** (comprador final o retailer más chico) — quiere ver el catálogo, colocar pedidos y pagar sin tener que llamar

### No es para
- Retail con menos de 10 SKUs (una peluquería, un carrito de comida)
- Empresas con más de US$1M/mes de facturación (necesitan un ERP tradicional)
- Servicios sin producto físico (consultores, agencias)

---

## 🔥 Problema que resolvemos

Un distribuidor venezolano promedio hoy:

1. **Lleva el inventario en Excel o cuaderno**, que se desactualiza al primer descuido.
2. **Recibe pedidos por WhatsApp en 3 líneas paralelas** (dueño + dos vendedores) sin consolidar en ningún lado.
3. **Cotiza a mano** cada vez, con margen inconsistente por cliente.
4. **No sabe cuál es su producto estrella** ni cuáles clientes están dejando de comprar.
5. **Vende en MercadoLibre desde el celular** actualizando precios y stock de a uno.
6. **No tiene sitio web** o tiene uno que su sobrino le armó en 2019.
7. **Depende de que él en persona esté disponible** — si se enferma dos días, la operación se cae.

DistribOS mata cada uno de esos dolores en la misma plataforma, sin que el merchant tenga que contratar a nadie, aprender a programar, ni comprar hardware.

---

## 💡 Propuesta de valor

**"El sistema operativo de tu distribuidora, con IA que te dice qué hacer."**

Somos el reemplazo del Excel + WhatsApp + MercadoLibre mobile + Google Sites que hoy usa un merchant, integrados en un solo panel, con capa de inteligencia artificial que:

- Responde a los clientes por WhatsApp en su nombre 24/7
- Publica sus productos en MercadoLibre en batch
- Genera los textos de su sitio web
- Analiza sus ventas y le dice quién está por dejar de comprarle, qué producto tiene margen bajo, dónde está su capital muerto

**Diferenciadores clave**:
1. **Pensado para Venezuela**: tasa BCV integrada, USD + Bs, moneda dual en cada precio, RIF, integración con MercadoLibre Venezuela (MLV).
2. **IA integrada, no un add-on**: el bot de WhatsApp usa Claude Haiku 4.5 con conocimiento del catálogo del merchant. Los insights de Analytics están anclados en datos reales, no genéricos.
3. **Multi-portal en una app**: admin del merchant, portal del cliente, portal del vendedor, sitio público, portal del superadmin — todo con el mismo login pero rutas separadas.
4. **Subdominio propio para cada merchant**: `mitienda.distribos.com` con sus 3 colores, su logo, su catálogo. Nadie más lo ofrece en VE por este precio.
5. **Setup en 30 minutos**: crear cuenta → subir productos (o import CSV) → conectar WhatsApp por QR → listo.

---

## 🚀 Cómo funciona (user journey)

### Onboarding del merchant (día 0)
1. El **superadmin** de DistribOS crea la cuenta del merchant desde su panel global (`/superadmin`). Genera usuario + contraseña y le envía las credenciales por WhatsApp/email.
2. El merchant entra en `/login`, cambia su contraseña.
3. Ve el dashboard con stats en cero y un checklist para empezar.

### Setup del catálogo (día 0-1)
1. **Categorías** — crea o importa desde CSV.
2. **Productos** — carga individual o import masivo. Sube imágenes (max 250KB c/u).
3. **Listas de precios** — crea "Distribuidor 20%", "Mayorista 10%", etc. Se aplican por cliente.
4. **Clientes** — carga los que ya tiene con RIF, datos fiscales, contacto.

### Setup de canales (día 1-2)
1. **WhatsApp**: escanea QR desde el panel, queda conectado.
2. **MercadoLibre**: conecta cuenta con OAuth, publica catálogo en masa desde `/inventory` (selecciona N productos → "Publicar en ML").
3. **Sitio web**: en `/site`, configura subdominio + 3 colores + logo + 4-7 imágenes + textos. Opcionalmente **la IA genera misión/visión/descripción** a partir del nombre del negocio.

### Operación diaria
1. **Llegan mensajes por WhatsApp** — el bot los responde según el catálogo del merchant. Si el cliente confirma un pedido, el bot lo registra automáticamente en el sistema.
2. **Llegan órdenes por MercadoLibre** — vía webhook se registran automáticamente y se descuenta stock.
3. **El vendedor coloca pedidos** desde su portal `/seller` en nombre de sus clientes asignados.
4. **Los clientes** entran a su portal `/portal` a ver sus pedidos y pagar.
5. **El admin ve todo consolidado** en `/analytics`, con **insights de IA** que le dicen qué acciones tomar esta semana.

### Ciclo de venta completo
```
Cliente pregunta por WA
  → Bot responde con precio, disponibilidad
  → Cliente confirma pedido
  → Bot crea ProductRequest (pending)
  → Cliente entra a portal y paga
  → Admin marca como pagado
  → Admin libera → se convierte en Sale
  → Stock descontado
  → Aparece en analytics del merchant
  → Si lo colocó un vendedor, cuenta para sus stats
```

---

## 🧩 Estructura del sistema (módulos)

### 1. **Admin del merchant** (`/`)
- Dashboard con stats y notificaciones
- **Categorías / Inventario** (30-1000 SKUs, con imágenes, márgenes, unidades)
- **Clientes** (con RIF, listas de precios asignadas, portal login opcional)
- **Vendedores** (crear, suspender, asignar clientes, ver ventas por vendedor)
- **Listas de precios** (múltiples, por cliente)
- **Pedidos** (`ProductRequest`, con estados pending → paid → released)
- **Ventas** (`Sale`, ya facturadas)
- **MercadoLibre** (conectar, publicar masivo, sync stock/precio, Q&A con IA)
- **WhatsApp** (conectar por QR, inbox, toggle bot IA global o por chat)
- **Sitio web** (editor completo con IA para textos)
- **Leads** del sitio web (inbox)
- **Analytics** con capa de **insights de IA**
- **Configuración** (BCV rate auto, moneda primaria, métodos de pago, notificaciones)

### 2. **Portal del cliente** (`/portal`)
- Cada cliente puede tener login propio (el admin lo crea)
- Ve **catálogo** con sus precios (según lista asignada)
- **Coloca pedidos** con carrito
- **Ve sus pedidos** y estados
- **Registra pagos** (parciales o totales, sube comprobante)
- **Mi perfil** para cambiar contraseña

### 3. **Portal del vendedor** (`/seller`)
- Login en `/vendedor` (URL propia para compartir)
- **Dashboard** con sus stats: clientes asignados, pedidos, ventas, total facturado
- **Mis clientes** — solo los asignados. Puede crear nuevos (se auto-asignan).
- **Nuevo pedido** — elige cliente asignado + productos, aplica lista de precios automáticamente
- **Mis pedidos** — historial de los que colocó
- **Mi perfil** — cambiar contraseña

### 4. **Sitio web público del merchant** (`{slug}.distribos.com` o `distribos.com/sites/{slug}`)
- Nav sticky con menú móvil
- Hero grande + tagline + CTA
- Sección "Nosotros" con misión/visión/descripción
- Galería de imágenes del negocio
- Catálogo (preview en home, completo en `/catalogo` con búsqueda y filtros)
- Formulario de contacto que crea `WebsiteLead` en el sistema
- 3 templates (Modern / Warm / Minimal) con los 3 colores del merchant

### 5. **Portal del superadmin** (`/superadmin`)
- Login en `/superadminloginpage`
- Lista de todos los merchants del sistema
- Crear nuevos merchants
- Suspender/habilitar cuentas
- Ver stats globales

### 6. **APIs internas**
- `/api/*` con NextAuth v5 credentials provider
- Endpoints por rol: `/api/portal/*`, `/api/seller/*`, `/api/superadmin/*`
- Webhooks públicos: `/api/whatsapp/webhook`, `/api/ml/webhook`, `/api/sites/{slug}/leads`

---

## 🤖 Capa de IA

Usamos **Claude Haiku 4.5** ($1/M input, $5/M output) para todas las features de IA. Casos concretos:

1. **WhatsApp bot** — responde clientes con conocimiento del catálogo del merchant + historial de conversación. Puede crear pedidos con una tool `create_order` que registra `ProductRequest`.
2. **Analytics insights** — analiza ventas, stock, clientes, márgenes. Devuelve 3-8 recomendaciones categorizadas (opportunity / warning / action / positive) con acciones concretas.
3. **Contenido del sitio** — genera misión, visión, descripción a partir del nombre + un contexto opcional.
4. **MercadoLibre Q&A** *(roadmap)* — sugiere respuestas a preguntas de compradores.

**Prompts anclados en datos reales** — el bot no inventa precios, los insights citan porcentajes específicos y nombres de productos/clientes, no dice adjetivos vacíos.

---

## 🏗️ Stack técnico (para referencia rápida)

- **Frontend + API**: Next.js 14 (App Router) + TypeScript strict
- **DB**: PostgreSQL + Prisma
- **Auth**: NextAuth v5 (credentials, JWT strategy)
- **UI**: Tailwind CSS + Radix UI + design system propio (dark mode con acento amber `#F5A623` sobre negro `#0F0F0F`)
- **Charts**: Recharts
- **WhatsApp**: Baileys (unofficial WhatsApp Web protocol)
- **MercadoLibre**: OAuth 2.0 + REST API
- **IA**: Claude Haiku 4.5 via Anthropic API
- **Hosting**: Railway (web + worker + Postgres, 3 servicios)
- **Repo**: monolito Next.js, ~150 archivos, ~30K líneas de código

---

## 💰 Modelo de negocio

### Planes propuestos

| Plan | Precio | Incluye | Uso típico |
|---|---|---|---|
| **Básico** | US$29/mo | Panel + inventario + ventas + clientes + MercadoLibre + sitio web (sin IA) | El que hace todo manual |
| **Full** | US$49/mo | Todo lo del básico + WhatsApp con bot IA + Analytics con IA + IA para contenido del sitio | El "quiero automatizar" |
| **Enterprise** | US$99/mo | Todo del full + vendedores ilimitados + soporte prioritario + SLA | Distribuidoras con 5+ vendedores |

### Economics (para 50 merchants activos)

- **Ingresos** (mix 30% básico, 50% full, 20% enterprise): ~US$2.700/mes
- **Costos**:
  - Railway (infra): ~US$120/mo
  - Anthropic API (IA): ~US$475/mo
  - Total costos: ~US$595/mo
- **Margen bruto**: ~78%
- **Break-even**: ~20-25 merchants

Cada merchant marginal cuesta ~US$10-12/mes en IA + hosting.

---

## 📊 Métricas / capacidad

- Un solo deploy multi-tenant soporta hasta **100 merchants activos** sin problemas de perf.
- WhatsApp Baileys: 1 sesión persistente por merchant, ~50MB RAM cada una.
- Rate limits: 1.000 req/hora a ML API, 1.000 req/min a Anthropic (por org).
- Backup: Railway auto-snapshots diarios de Postgres.

---

## 🎯 Diferenciadores vs alternativas

### vs Excel + WhatsApp + MercadoLibre app
- Todo integrado
- No se pierden pedidos
- Descuenta stock automáticamente
- Historial completo por cliente
- Backup en la nube

### vs Bsale, Alegra, Nubox, Colppy (contadores/facturación)
- Somos SISTEMA OPERATIVO, no facturación (aunque tenemos algo de eso)
- Ellos son fuertes en contabilidad; nosotros en **operación diaria** del distribuidor
- Ellos no tienen bot IA en WhatsApp, ni sitio web del negocio, ni portal para vendedores/clientes

### vs SAP, Oracle NetSuite, Odoo
- 1/50 del costo
- 1/20 del tiempo de implementación
- No requiere consultor ni entrenamiento

### vs Tiendanube / Shopify
- Ellos son ecommerce first (comprador anónimo online); nosotros somos **wholesale first** (con vendedores, listas de precios por cliente, ML)
- Ellos no tienen WhatsApp bot, ni portal para vendedores en calle

---

## 🗓️ Roadmap futuro (features pendientes)

### Q próximo
- MercadoLibre: gestión de preguntas con IA (sugerencia + auto-respuesta)
- MercadoLibre: sync bidireccional automático via cron (worker existente)
- Cuentas por cobrar con reportes por cliente
- App móvil PWA para el vendedor en calle

### Después
- Ruteo de entrega (Mapbox/OSM) para múltiples pedidos
- Comisiones automáticas del vendedor
- Marketplace interno (merchants venden a merchants)
- Integración con Zelle / Binance Pay
- Reportes SENIAT / factura fiscal

---

## ❓ FAQ (para responder objeciones típicas)

**"¿Es seguro conectar mi WhatsApp?"**
Sí. Usamos el mismo protocolo de WhatsApp Web. La sesión queda cifrada con AES-256 en nuestro server. Nunca vemos tus mensajes salvo el bot que los procesa para responder por vos.

**"¿Y si baneban mi número por usar bot?"**
Riesgo bajo si el bot respeta ritmos humanos (que lo hace). Para producción a escala, tenemos plan de migrar a WhatsApp Business API oficial (más cara pero sin riesgo de ban).

**"¿Necesito internet estable?"**
Sí, el sistema es cloud. Sin internet no funciona ni tu Excel de Google Drive tampoco.

**"¿Puedo importar mi Excel existente?"**
Sí. Importamos productos, clientes y categorías por CSV. Hay plantillas descargables en cada sección.

**"¿Y si quiero probar antes de pagar?"**
14 días de trial completo, sin tarjeta. Al día 15 elegís plan o se pausa la cuenta.

**"¿Corre en Bs o en USD?"**
Ambos. La moneda primaria la elegís vos. La tasa BCV se actualiza automáticamente cada día.

**"¿Se puede sacar la data si me voy?"**
Sí. Export completo a CSV de todo (productos, clientes, ventas, pedidos) en cualquier momento.

**"¿Tienen factura fiscal?"**
No todavía. Es parte del roadmap. Por ahora emitimos comprobantes internos.

---

## 🎨 Identidad de marca

**Nombre**: DistribOS (wordmark en dos tonos: "Distrib" cream, "OS" amber).

**Símbolo**: cuadrado oscuro redondeado con chevron `>` cream y una barra vertical amber a la derecha. Semánticamente: *play + control* — el sistema corre solo, y el distribuidor tiene el botón de pausa.

**Paleta**:
| Rol            | Hex        |
|----------------|------------|
| Fondo (ink)    | `#0F0F0F`  |
| Superficie     | `#1A1A1A`  |
| Texto (cream)  | `#F5F3EF`  |
| Acento (amber) | `#F5A623`  |

**Tipografía**: Syne (display), DM Sans (body), DM Mono (números).

Referencia canónica y variantes de logo: `docs/brand/DistribOS-Identidad-Logos.html`.
Componente reutilizable: `components/brand/Logo.tsx`.

---

## 📝 Guías de tono para generación de contenido

### Voz de marca
- **Cercana pero profesional** — hablamos de tú/vos, no de usted. Nada de "estimado cliente"
- **Concreta** — nada de "empoderamos", "sinergias", "verticales". Decimos QUÉ hace la feature y QUÉ resuelve.
- **Anti-Silicon-Valley** — no somos Notion. Somos un mayorista de barrio con software bueno.
- **Venezolano neutro** — evitamos regionalismos muy fuertes ("chévere" sí, "guaraña" no), pero mantenemos calidez.

### Cosas a evitar
- ❌ "En un mercado tan competitivo..."
- ❌ "Somos la solución integral..."
- ❌ "Empoderamos a los emprendedores..."
- ❌ Adjetivos vacíos: revolucionario, disruptivo, líder indiscutible
- ❌ Promesas sin números: "ahorra tiempo", "vende más"

### Cosas a favor
- ✅ Números específicos: "ahorra 2 horas al día", "sube 3x tu velocidad de respuesta"
- ✅ Ejemplos concretos: "María, dueña de una distribuidora en Maracaibo, subió sus ventas 40%..."
- ✅ Voz de merchant: "Estaba loco con Excel y WhatsApp"
- ✅ Callouts para dolores reales: "Tu vendedor te pasó el pedido pero el producto ya no había"

---

## 🔄 Cómo mantener este archivo actualizado

**Cada vez que se mergea una PR user-facing significativa**, actualizar la sección relevante:
- Feature nueva → agregar a "Módulos"
- Cambio de rol/permisos → actualizar sección de portal correspondiente
- Cambio de precios → actualizar "Modelo de negocio"
- Integración nueva → mencionar en TL;DR + módulo correspondiente
- Cambio de stack → actualizar "Stack técnico"

**Regla**: si un vendedor no puede explicar bien la feature con este brief, no está bien reflejada acá.

---

**Última actualización**: 2026-07 (versión post-PR #50, con superadmin, vendedores, sitio web, MercadoLibre publicación masiva, IA en analytics, WhatsApp e identidad visual DistribOS aplicada).

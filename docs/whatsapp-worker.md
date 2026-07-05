# WhatsApp Worker (Baileys)

Proceso Node separado que mantiene las sesiones de WhatsApp vivas. El web (Next.js) le habla por HTTP interno.

## Por qué es un proceso separado

Baileys mantiene un WebSocket persistente contra WhatsApp por cada sesión. Los serverless/lambdas de Next.js no tienen procesos long-running — necesitan un worker aparte que corra 24/7.

## Deploy en Railway

1. **Añade un nuevo servicio** al mismo proyecto (mismo repo).
2. **Start command**: `npm run worker`
3. **Variables de entorno**:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}       # comparte la misma DB del web
   WA_WORKER_PORT=3001
   WA_WORKER_SECRET=<openssl rand -hex 32>       # secret compartido con el web
   WA_ENCRYPTION_KEY=<openssl rand -hex 32>      # cifra el authState en Postgres
   ANTHROPIC_API_KEY=<same as web>               # para el bot IA
   ```
4. **Networking**: activa "Private Networking" para que el web pueda alcanzarlo por su URL interna.

Luego en el **servicio web**, agrega:
```
WA_WORKER_URL=http://<worker-service>.railway.internal:3001
WA_WORKER_SECRET=<el mismo secret>
WA_ENCRYPTION_KEY=<la misma key>
```

Reinicia el web. En `/whatsapp` deberías ver "Conectar mi WhatsApp".

## Local (dev)

```bash
# terminal 1
npm run dev

# terminal 2
WA_ENCRYPTION_KEY=$(openssl rand -hex 32) \
WA_WORKER_SECRET=dev-secret \
DATABASE_URL="..." \
npm run worker
```

En el `.env` del web:
```
WA_WORKER_URL=http://localhost:3001
WA_WORKER_SECRET=dev-secret
WA_ENCRYPTION_KEY=<el mismo hex>
```

## Datos que persistimos y cómo

- **`WhatsAppSession.authState`**: cifrado con AES-256-GCM usando `WA_ENCRYPTION_KEY`. Si se dumpea la DB sin la key, no se puede clonar la sesión.
- **`WhatsAppContact`**: metadata del contacto (número, nombre, unread, último mensaje preview).
- **`WhatsAppMessage`**: contenido de mensajes. Purga automática según `Settings.waRetentionDays` (default 90 días).

## Modo privado (retención 0)

Cuando `waRetentionDays = 0`, el cron nocturno borra todo mensaje al día siguiente de creado. Sólo queda metadata (fecha, contacto, dirección). El bot IA y la búsqueda quedan deshabilitados por diseño.

## Bot IA

- Se dispara sólo cuando `WhatsAppContact.aiEnabled = true` para esa conversación.
- Usa Claude Haiku 4.5 con contexto: últimos 12 mensajes + info del cliente vinculado + top 30 productos.
- Si el bot detecta incertidumbre, responde con `ESCALATE: razón` y se crea notificación al admin en lugar de enviar el mensaje.

## Warm-up del número

Recomendación para evitar baneos de WhatsApp:
- No más de 20 chats iniciados por día el primer mes.
- Nada de broadcast masivo.
- Responder dentro de ventanas de 24h iniciadas por el cliente es siempre seguro.

## Reconexión automática

Al arrancar, el worker restaura todas las sesiones con status `connected`, `qr_pending` o `connecting`. Si se cae la conexión, reintenta cada 3s excepto cuando el usuario cerró sesión desde el móvil (WA "loggedOut").

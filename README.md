# Money Tracker

App personal para registrar inversiones en acciones y calcular rendimiento.

## Stack

- Node.js + Express + TypeScript (ESM)
- PostgreSQL con Prisma ORM
- Yahoo Finance vía `yahoo-finance2`
- Bot de Telegram con `grammy`
- Jobs con `node-cron`

## Instalación

```bash
npm install
```

Crea tu archivo de entorno en `prisma/.env` (o `.env` en la raíz):

```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/money_tracker"
JWT_SECRET="un_secreto_largo_y_aleatorio"
TELEGRAM_BOT_TOKEN=""   # opcional
SEED_USER_EMAIL=""      # opcional, usuario demo del seed (def. demo@example.com)
SEED_USER_PASSWORD=""   # opcional (def. Demo12345)
```

Aplica migraciones y carga datos de ejemplo:

```bash
npx prisma migrate dev
npm run seed
```

Carga el historial de precios reales (solo una vez por activo):

```bash
npm run backfill
```

Inicia el servidor:

```bash
npm run dev
```

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar JWT |
| `PORT` | No (def. 3000) | Puerto del servidor |
| `ALLOWED_ORIGINS` | No | CORS origins separados por coma |
| `TELEGRAM_BOT_TOKEN` | No | Token del bot de Telegram |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | No | Usuario dueño de los datos del seed |

## API

Base: `http://localhost:3000`

Todas las rutas `/api/*` excepto `register`, `login` y `refresh` requieren `Authorization: Bearer <token>`.
Cada usuario tiene sus propios activos y operaciones: el dueño se guarda en `assets.userId`
(las operaciones, precios y recordatorios lo heredan vía su activo). Un id de otro usuario responde 404.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servidor |
| GET | `/api/assets` | Lista de activos |
| POST | `/api/assets` | Crear activo `{ symbol, name, currency }` |
| PATCH | `/api/assets/:id` | Editar activo |
| GET | `/api/transactions` | Operaciones (filtros: `assetId`, `type`, `from`, `to`) |
| POST | `/api/transactions` | Registrar compra o venta |
| PATCH | `/api/transactions/:id` | Editar operación |
| DELETE | `/api/transactions/:id` | Eliminar operación |
| GET | `/api/summary` | Resumen del portafolio (params: `from`, `to`) |
| GET | `/api/assets/:id/performance` | Serie diaria de valor (params: `from`, `to`) |
| POST | `/api/prices/refresh` | Actualizar precios desde Yahoo Finance (solo ADMIN/SUPER_ADMIN) |
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Login |
| POST | `/api/user/me/telegram/link-code` | Código de un solo uso (10 min) para vincular Telegram |
| DELETE | `/api/user/me/telegram` | Desvincular Telegram |

## Bot de Telegram

Cada usuario vincula su propio chat:

1. `POST /api/user/me/telegram/link-code` → `{ code, expiresAt }`.
2. En Telegram, envía `/link CÓDIGO` al bot.

Un chat sin vincular solo acepta `/start` y `/link`. Los comandos y recordatorios usan los activos del usuario vinculado.

| Comando | Descripción |
|---|---|
| `/link CÓDIGO` | Vincular el chat a tu cuenta |
| `/compra SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]` | Registrar compra con confirmación |
| `/venta SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]` | Registrar venta con confirmación |
| `/resumen` | Ganancia y % por activo |
| `/ultima SÍMBOLO` | Última compra del activo |

Formato de fecha: `YYYY-MM-DD` (por defecto: hoy).

Ejemplo: `/compra CUERVO.MX 100 32.50 45 2025-01-10`

## Jobs programados

| Job | Horario | Descripción |
|---|---|---|
| Actualizar precios | Lunes–viernes 16:00 CT | Cierre de BMV y NYSE |
| Recordatorio de compra | Diario 9:00 CT | Avisa si compraste un activo hace menos de 7 días |

## Cálculo de rendimiento

```
ganancia = valor_al_final + ventas_del_rango − valor_al_inicio − compras_del_rango
porcentaje = ganancia / (valor_al_inicio + compras_del_rango)
```

- Si `from` es la fecha de la primera operación, `valor_al_inicio = 0`.
- El valor de una fecha = títulos en esa fecha × último precio conocido hasta esa fecha.
- **No es un rendimiento ponderado por tiempo** — es un cálculo simple de ganancia absoluta sobre capital invertido en el período.
- El costo promedio usa el método de **promedio ponderado**: `Σ(cantidad × precio + comisión) / Σcantidad` de compras únicamente.

## Scripts

```bash
npm run dev       # servidor con hot reload
npm run seed      # datos de ejemplo (borra todo primero)
npm run backfill  # carga historial real desde Yahoo Finance
npm test          # tests unitarios (node:test)
```

# Setup — local development

## Передумови

- Node.js ≥ 22.12 (`.nvmrc` → 22)
- pnpm 10 (`corepack enable` підхопить версію з `packageManager`)
- Docker + Docker Compose

## Кроки

```bash
pnpm install                 # залежності (prisma generate виконується в build)
cp .env.example .env         # конфігурація local development (дефолти робочі)
docker compose up -d         # PostgreSQL 17 + Redis 7 + MinIO (bucket створюється сам)
pnpm db:migrate              # Prisma-міграції (потрібна піднята БД)
pnpm build                   # збірка пакетів і застосунків
pnpm dev                     # web:3000 + worker + render-worker у watch-режимі
```

Definition of Done Milestone 0 (ТЗ §21): `pnpm install` → `docker compose up` →
`pnpm db:migrate` → `pnpm dev`, усі сервіси healthy.

## Health-перевірки

| Процес        | URL                                  |
| ------------- | ------------------------------------ |
| web           | http://localhost:3000/api/health     |
| worker        | http://localhost:3001/health         |
| render-worker | http://localhost:3002/health         |

`200 ok` — усі компоненти живі; `503 degraded` — у JSON видно, який компонент упав.

## Команди якості

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e        # Playwright (збирає web сам; браузер: npx playwright install chromium)
pnpm format          # Prettier
```

У середовищах із попередньо встановленим Chromium іншої ревізії:
`PW_CHROMIUM_EXECUTABLE=/шлях/до/chrome pnpm test:e2e`.

## Prisma

```bash
pnpm db:generate     # регенерація клієнта
pnpm db:migrate      # migrate dev (локально)
pnpm db:studio       # Prisma Studio
```

## Секрети

- `.env` не комітиться; `.env.example` — єдиний шаблон.
- `ENCRYPTION_KEY`: `openssl rand -hex 32` (обовʼязковий при `APP_ENV=production`).
- Токени Shopify/Meta/AI ніколи не потрапляють у browser bundle і логи
  (маскування — `packages/observability`).

# Ormilo Growth OS

Внутрішня платформа автоматизації Shopify-дропшипінгу: product research і scoring,
Product Page Builder, Creative Factory (статика/відео/UGC), публікація в Shopify
(Draft-first), контроль постачальників, маршрутизація замовлень та аналітика.
Усі небезпечні дії проходять через Approval Queue.

**Архітектура:** modular monolith (Next.js) + background worker + render worker.
Документація: [бриф/вимоги](docs/brief-ormilo-growth-os-ua.md) ·
[план імплементації](docs/implementation-plan.md) ·
[архітектура](docs/architecture.md) · [assumptions](docs/assumptions.md) ·
[ризики](docs/risks.md).

> Файл `index.html` у корені — старий статичний сайт, не повʼязаний із системою
> (див. assumption A3).

## Стан

| Milestone | Стан |
| --------- | ---- |
| M0 — інфраструктура (monorepo, Docker Compose, CI, health) | ✅ |
| M1 — core domain (users, stores, approvals, audit, outbox) | ⏳ наступний |
| M2–M6 — research → креативи → Shopify → orders → analytics | 🔜 |
| M7 — Meta Marketing API (optional) | 🔜 |

## Стек

TypeScript (strict) · Node.js 22 · pnpm + Turborepo · Next.js 15 (App Router) ·
PostgreSQL + Prisma · Redis + BullMQ · Zod · Tailwind CSS 4 · Vitest · Playwright ·
MinIO (S3) · Docker Compose. З M3: Remotion, FFmpeg, Sharp.

## Швидкий старт

Потрібні: Node.js ≥ 22.12, pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install                 # залежності (+ prisma generate у build)
cp .env.example .env         # конфігурація local development
pnpm infra:up                # PostgreSQL + Redis + MinIO
pnpm db:migrate              # міграції (потрібна піднята БД)
pnpm build                   # збірка всіх пакетів і застосунків
pnpm dev                     # web:3000 + worker + render-worker (watch)
```

Health-и: `http://localhost:3000/api/health` (web),
`http://localhost:3001/health` (worker), `http://localhost:3002/health` (render-worker).

## Команди

| Команда | Дія |
| ------- | --- |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` по всіх пакетах |
| `pnpm test` | Unit-тести (Vitest) |
| `pnpm test:e2e` | Playwright E2E (apps/web; збирає web автоматично) |
| `pnpm build` | Turbo build (libs → dist, web → .next) |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Prisma |
| `pnpm infra:up` / `infra:down` | Docker Compose (infra/) |

## Структура

```
apps/
  web/            Next.js UI + API routes (health, далі — dashboard)
  worker/         BullMQ system-черга, heartbeat, health :3001
  render-worker/  BullMQ render-черга (Remotion/FFmpeg з M3), health :3002
packages/
  config/         Zod-валідація env (production-guard, Shopify API version)
  contracts/      спільні Zod-контракти (health, черги)
  db/             Prisma schema + фабрика клієнта
  domain/         Result, DomainError, DomainEvent
  integrations/   adapter-інтерфейси (AI providers) + structured output validation
  observability/  pino logger із redaction, health-утиліти, health-server
  templates/      формати креативів (9:16, 4:5, 1:1; 10/15/20/30 c)
  test-utils/     тестові хелпери
  ui/             cn + UI-примітиви (база під shadcn/ui)
infra/            docker-compose: PostgreSQL 17, Redis 7, MinIO
docs/             бриф, план, архітектура, assumptions, ризики
```

## Environment

Повний перелік — у [`.env.example`](.env.example). Ключове:

- дефолти відповідають `infra/docker-compose.yml` (лише local development);
- `NODE_ENV=production` відмовляється стартувати без явних значень критичних
  змінних (`packages/config`);
- `SHOPIFY_API_VERSION` (зараз `2026-07`) — у конфігурації, не в коді;
- секрети не логуються: центральний logger маскує чутливі поля.

## CI

GitHub Actions (`.github/workflows/ci.yml`): `install → lint → typecheck → test →
build`, окремим job — Playwright E2E. E2E працюють і без піднятої інфраструктури:
health-контракт валідний в обох станах (`200 ok` / `503 degraded`).

## Правила розробки (короткий витяг)

- Бізнес-логіка не в React components; domain не залежить від Next.js.
- Зовнішні системи — лише через adapter interfaces; спершу mock + contract tests.
- Усі зовнішні payloads (env, jobs, webhooks, AI outputs) — через Zod.
- Background jobs idempotent; помилки не ховаються; `any` заборонено.
- Approval-first: публікації/ціни/реклама/замовлення — лише через підтвердження;
  Shopify → Draft, Meta → Paused, supplier orders у dev заборонені.

Повні правила — у [docs/architecture.md](docs/architecture.md) і
[брифі](docs/brief-ormilo-growth-os-ua.md).

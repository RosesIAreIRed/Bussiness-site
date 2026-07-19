# Ormilo Growth OS — план імплементації

Джерело вимог: `docs/brief-ormilo-growth-os-ua.md` (повне ТЗ відсутнє — див. A1 в
`docs/assumptions.md`). Ризики: `docs/risks.md`. Архітектура: `docs/architecture.md`.

## Принципи виконання

1. Milestone-и виконуються послідовно; кожен закривається зеленими
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. Без placeholder-коду, який імітує готовність: якщо функції немає — її немає
   в UI/API, а в плані вона позначена як заплановану.
3. Зовнішні інтеграції починаються з mock adapter + contract tests; реальні
   провайдери підключаються окремо.
4. Усі небезпечні дії — через Approval Queue (з M1).
5. Після кожного milestone оновлюються README та architecture docs.

## Стан milestones

| Milestone | Стан | Коментар |
| --------- | ---- | -------- |
| M0 — інфраструктура | ✅ виконано | цей коміт |
| M1 — core domain | ⏳ наступний | |
| M2 — research/scoring | 🔜 | |
| M3 — Creative Factory | 🔜 | |
| M4 — Shopify publishing | 🔜 | |
| M5 — orders/supplier | 🔜 | |
| M6 — analytics | 🔜 | |
| M7 — Meta (optional) | 🔜 | після стабільного Shopify flow |

---

## Milestone 0 — інфраструктура (виконано)

**Зроблено:**

- Monorepo: pnpm workspaces + Turborepo; каталог версій (pnpm catalog).
- 3 застосунки: `web` (Next.js 15 App Router + Tailwind 4), `worker` і
  `render-worker` (BullMQ-скелети: system/render черги, heartbeat через
  `upsertJobScheduler`, graceful shutdown, health HTTP-сервери).
- 9 пакетів: `config` (Zod env-валідація з production-guard), `contracts`
  (health + queue контракти), `domain` (Result/DomainError/DomainEvent),
  `observability` (pino logger із redaction, health-утиліти, health-server),
  `db` (Prisma 6 + фабрика клієнта), `integrations` (AI provider interfaces +
  валідація structured output), `templates` (формати креативів 9:16 / 4:5 / 1:1,
  тривалості відео), `ui` (cn + Button), `test-utils`.
- `infra/docker-compose.yml`: PostgreSQL 17, Redis 7, MinIO (+ авто-створення bucket).
- Health endpoints: `web /api/health`, worker `:3001/health`,
  render-worker `:3002/health` — спільний контракт `healthReportSchema`.
- Лінт (ESLint 9 flat, `no-explicit-any` = error, `no-console` = error), Prettier,
  strict TypeScript, Vitest unit-тести в кожному пакеті з логікою, Playwright E2E
  (health contract + рендер головної), GitHub Actions CI (quality + e2e jobs).
- README, `.env.example`, документація (бриф/план/assumptions/ризики/архітектура).

**Свідомо не входить у M0** (щоб не створювати фейкову готовність): доменні моделі
та міграції (крім технічної `SystemHeartbeat`), auth/RBAC, Approval Queue,
Shopify/Meta/supplier adapters, реальні AI-провайдери, Remotion/FFmpeg/Sharp.

## Milestone 1 — core domain (наступний)

- Prisma-моделі: `User`, `Store`, `ProductCandidate`, `Product`, `Asset`,
  `ApprovalTask`, `AuditLog`, `DomainEventOutbox` (+ перша міграція, seed data).
- Auth (внутрішні користувачі) + RBAC (roles: admin, operator, viewer).
- Approval Queue: модель, статуси (pending/approved/rejected), API, UI-список.
- Audit log: запис усіх мутацій із actor/entity/diff.
- Outbox pattern: доменні події з транзакційним записом; worker публікує в черги.
- BullMQ: політика attempts/backoff/DLQ; heartbeat пише `SystemHeartbeat` у БД.
- Basic dashboard: списки candidates/products/approvals (read-only + дії approve).
- CI: job з PostgreSQL/Redis services; інтеграційні тести db-шару.

**Критерій готовності:** створення candidate → approval task → approve →
audit log + domain event в outbox → оброблений worker-ом; все під тестами.

## Milestone 2 — research/scoring

- Ручний імпорт кандидата + URL-import abstraction (adapter, без скрейпінгу
  заборонених джерел).
- Product Intelligence Brief (mock TextGenerationProvider → structured JSON + Zod).
- Product Score 0–100 (фактори з брифу; поріг 65; критичні red flags → reject).
- Pricing calculator: маржа, break-even CPA, break-even ROAS.
- Prompt versioning (таблиця prompts + версії, привʼязка до generation).
- Compliance rules: заборонені claims (medical тощо) на рівні валідації.

## Milestone 3 — Creative Factory

- Creative Brief → Creative Batch → Concepts (angles/hooks/texts/headlines/CTA).
- Static templates (React → Sharp; 9:16, 4:5, 1:1; PNG/JPEG/WebP; preview;
  asset source + license metadata).
- Video: Remotion templates + FFmpeg (MP4 H.264, AAC; 10/15/20/30 c;
  1080×1920, 1080×1350, 1080×1080; субтитри, voice-over через TTS interface).
- Render jobs у render-worker (черга `render`), progress, retry, cost tracking.
- UGC-сценарії, compliance-звіт по батчу, файлові імена та UTM-структура.
- Approval перед export; заборона фейкових reviews/medical claims на рівні правил.

## Milestone 4 — Shopify

- Adapter через GraphQL Admin API (версія з env; operations у `.graphql` файлах,
  усі поля звірені з документацією 2026-07).
- Store connection (encrypted tokens), product draft creation (productCreate →
  variants bulk → media async → metafields → collections), sync, preview,
  publish лише через approval; `userErrors` перевіряються всюди.

## Milestone 5 — orders/supplier

- Order webhooks: signature verification, event inbox, idempotency, retry, DLQ,
  audit.
- Order state machine (paid → routed → ordered → tracked → fulfilled + edge cases).
- `SupplierAdapter` interface + `ManualSupplierAdapter` (готує дані, замовлення
  вручну; у dev реальні замовлення заборонені).
- Supplier Monitor: price/stock snapshots за розкладом, зміни → alert + approval task.

## Milestone 6 — analytics

- Звʼязка креатив ↔ товар ↔ angle/hook/format ↔ (Meta IDs) ↔ spend/CTR/CPA/ROAS.
- Contribution margin по товару/креативу.
- Creative iteration briefs (авто-завдання на варіації переможців).

## Milestone 7 (optional) — Meta Marketing API

- Окремий adapter для власних кампаній (campaigns/ad sets/ads/insights; все Paused).
- Окремий adapter для research-імпорту з дозволених джерел.

## Верифікація (кожен milestone)

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e        # web E2E
pnpm infra:up        # локальна інфраструктура для ручної перевірки
```

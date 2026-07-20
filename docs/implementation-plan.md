# Ormilo Growth OS — план імплементації

Джерело вимог: **`docs/ormilo_growth_os_technical_spec_ua.md`** (повне ТЗ; посилання
виду §N — на його розділи). Історичний бриф: `docs/brief-ormilo-growth-os-ua.md`.
Ризики: `docs/risks.md`. Архітектура: `docs/architecture.md`. Setup: `docs/setup.md`.

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
| M0 — інфраструктура | ✅ виконано | |
| M1 — core domain + UI shell | ✅ виконано | |
| M2 — product intelligence | ✅ виконано | |
| M3 — Creative Factory | ⏳ наступний | |
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

**Пост-M0 звірка з повним ТЗ** (окремий коміт, див. A16): ТЗ додано в repo,
compose перенесено в корінь, env-схема розширена до §24, план переглянуто за §21.

## Milestone 1 — Core domain and UI shell (виконано; ТЗ §21 M1)

**Зроблено:** Prisma-моделі §7 (users, stores, product_candidates, products, assets,
approvals, audit_logs, outbox_events) + офлайн-міграція `m1_core_domain` + seed
(admin + demo-кандидат); security-примітиви (scrypt-паролі, AES-256-GCM,
HMAC-сесії) у `@ormilo/domain`; repository/service pattern + UnitOfWork на
`$transaction`; CandidateService і ApprovalService (RBAC, idempotency, audit,
outbox у кожній мутації); outbox-publisher у worker (retry/backoff/dead-letter);
auth (login/logout, session cookie) і захищений UI shell (Dashboard, Research
з формою кандидата, Approvals із approve/reject, Products, Audit, Settings);
інтеграційні тести проти PostgreSQL (CI service) + E2E повного циклу
«кандидат → approval → продукт → audit» (CI з БД). Разом: 87 unit-тестів,
3 інтеграційні, 6 E2E-сценаріїв.

### Початковий план M1 (для звірки)

- Prisma-моделі (§7): `users`, `stores` (encrypted token), `product_candidates`,
  `products`, `assets`, `approvals`, `audit_logs` + outbox-таблиця domain events
  (§8); перша міграція; seed data (§25).
- Auth: single-tenant login (§20), внутрішні користувачі, RBAC (admin / operator /
  viewer); session — server-side; секрети лише server-side (§16).
- Approval Engine (§19): статуси PENDING / APPROVED / REJECTED / EXPIRED /
  CANCELLED; сервіс + UI-черга.
- Audit log: усі мутації з actor/action/entity/metadata (§7 audit_logs).
- Repository/service pattern; domain services без залежності від Next.js (§25).
- Outbox pattern (§8): транзакційний запис подій; worker публікує в BullMQ.
- Dashboard shell (§11): навігація Dashboard / Research / Products / Approvals /
  Audit / Settings зі справжніми списками (порожні стани — чесні).
- Шифрування at rest (AES-256-GCM, `ENCRYPTION_KEY`) для store token (§16).
- CI: job з PostgreSQL/Redis services; інтеграційні тести db-шару.

**Критерій готовності:** login → створення candidate (форма) → approval task →
approve/reject → audit log + подія в outbox → оброблена worker-ом; повторна
обробка idempotent; все під тестами.

## Milestone 2 — Product intelligence (виконано; ТЗ §21 M2)

**Зроблено:** доменний research-модуль — нормалізація raw-даних (§2.2),
scoring 0–100 із вагами/штрафами/критичними red flags (§2.2: <65 → REJECT,
65–74 → WATCH, ≥75 → TEST), pricing-калькулятор (§2.3: min viable /
recommended / compare-at / bundle, break-even CPA і ROAS = 1/CM ratio),
Compliance Guard (§15: PASS / PASS_WITH_WARNINGS / BLOCKED; BLOCKED піднімає
unrealisticClaims до критичного); Zod-контракти AI-outputs (§14
ProductBriefSchema + assessment + analysisResult); versioned prompts
`product-brief@v1` і `candidate-assessment@v1` у @ormilo/templates (§14);
MockTextGenerationProvider із фабрикою за TEXT_AI_PROVIDER (§26 п.7);
CandidateAnalysisService: requestAnalysis (UI, швидка транзакція + подія) →
runAnalysis у worker-і через ProductAnalysisRequested; UI: кнопка «Аналізувати»
і детальна сторінка кандидата (score breakdown, pricing, compliance, brief,
assessment). 125 unit-тестів; інтеграційний тест pipeline проти PostgreSQL;
E2E з реальним worker-ом (другий webServer у Playwright).

### Початковий план M2 (для звірки)

- Ручний імпорт кандидата + URL-import abstraction (без скрейпінгу заборонених
  джерел, §2.2/§27); normalized schema (§7 product_candidates).
- AI provider abstraction + mock TextGenerationProvider; prompt versioning
  (§14, таблиця prompt_versions).
- Product Brief (§14 ProductBriefSchema) → structured JSON + Zod.
- Product Score 0–100 (ваги та штрафи §2.2; поріг 65; критичні red flags → reject).
- Pricing calculator (§2.3): minimum viable / recommended / compare-at / bundle
  price, break-even CPA, break-even ROAS (`1 / contribution margin ratio`).
- Compliance checks (§15): PASS / PASS_WITH_WARNINGS / BLOCKED; BLOCKED —
  лише admin override з коментарем в audit log.

## Milestone 3 — Creative Factory (ТЗ §21 M3)

- Creative Brief → Creative Batch → Creative Matrix (§2.1: 6 кутів × 4 hooks,
  3 primary texts, 3 headlines, 2 CTA) → Concepts.
- Static templates (§2.1): React/HTML → рендер через Playwright або Satori →
  обробка Sharp; формати 9:16 / 4:5 / 1:1; PNG/JPEG/WebP; safe zones; логотип;
  asset source + license metadata обовʼязкові.
- Video: Remotion + FFmpeg (MP4 H.264, AAC; 10/15/20/30 c; 1080×1920,
  1080×1350, 1080×1080; субтитри .srt; voice-over через TTS adapter).
- Render queue у render-worker: progress, retry, cost tracking; Cost Guardrails
  (§18): max 6 static / 3 video / 24 hooks, бюджети AI_DAILY_BUDGET_USD і
  AI_CREATIVE_BATCH_BUDGET_USD, hard stop.
- Compliance Guard перед render і перед export (§15); approval перед export (§19).

## Milestone 4 — Shopify Publisher (ТЗ §21 M4)

- Store connection (encrypted token, §6.1); GraphQL client (versioned `.graphql`
  files, §6.4; версія API з env; без hardcoded GIDs; cursor pagination;
  rate limit handling; `userErrors` всюди, §12).
- Product draft flow (§2.3): Draft → media (async, перевірка статусу) → options →
  variants → pricing → SKU → supplier mapping → metafields → collections →
  preview → publish ЛИШЕ через approval.
- Webhook ingestion (§12): signature verification, event inbox (webhook_events),
  idempotency, retry, audit.

## Milestone 5 — Orders and suppliers (ТЗ §21 M5)

- Order webhook → state machine (§2.5): RECEIVED … FULFILLED / CANCELLED /
  FAILED / DEAD_LETTER; перевірки payment/address/duplicate/mapping/stock/
  margin guard/risk flags.
- `SupplierAdapter` interface (§2.5) + `ManualSupplierAdapter` (task з усіма
  даними; реальне замовлення — вручну; у dev supplier orders заборонені, §16).
- Supplier Price and Stock Monitor (§2.4): snapshots за розкладом, порівняння,
  margin recalc, alert + approval при небезпечній зміні; історія цін.
- Tracking workflow → Shopify fulfillment.

## Milestone 6 — Analytics (ТЗ §21 M6)

- Shopify metrics sync; cost model (COGS, shipping, fees, refund reserve);
  profit dashboard; contribution margin (§2.7).
- Creative-to-product mapping; **CSV import для Meta metrics** (API — лише M7).
- Creative Feedback Loop (§2.7): winning hook/angle/format → iteration brief;
  автоматична активація реклами заборонена.

## Milestone 7 (optional) — Meta adapter (ТЗ §21 M7, §13)

- Meta account connection, insights sync, upload media, create creative,
  create **paused** ad, approval, mapping/errors.
- Research adapter відділений від publishing adapter (§13).

## Мапа таблиць §7 → milestones

| Таблиці | Milestone |
| ------- | --------- |
| users, stores, product_candidates, products, assets, approvals, audit_logs, outbox | M1 |
| prompt_versions (+creative_briefs input) | M2 |
| creative_briefs, creative_batches, creative_concepts, render_jobs | M3 |
| product_variants, webhook_events | M4 |
| supplier_snapshots, orders, supplier_orders | M5 |
| metric_snapshots, automation_runs | M6 |

## Верифікація (кожен milestone)

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e        # web E2E
pnpm infra:up        # локальна інфраструктура для ручної перевірки
```

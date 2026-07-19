# Ormilo Growth OS — бриф (джерело вимог)

> **Статус документа.** Повне ТЗ (`ormilo_growth_os_technical_spec_ua.md`) у repository
> **відсутнє** — цей файл фіксує вимоги, отримані в постановці задачі, і є чинним
> джерелом вимог, доки не додано повне ТЗ. Після додавання ТЗ розбіжності
> вирішуються на користь ТЗ (див. `docs/assumptions.md`, A1).

## Що таке Ormilo Growth OS

Внутрішня система автоматизації Shopify-дропшипінгу повного циклу:

```
Товар або URL
      ↓
Product Research та AI-аналіз
      ↓
Оцінка товару, ризиків, ціни й офера
      ↓
Product Page Builder
      ↓
Creative Factory
      ↓
Статичні креативи / відео / UGC-сценарії
      ↓
Ручне підтвердження (Approval Queue)
      ↓
Shopify Draft + Meta Paused Ads
      ↓
Продажі та рекламні метрики
      ↓
Нові варіації успішних креативів
```

## Ключові архітектурні рішення

1. **Modular monolith**, окремий background worker і render worker. Без мікросервісів
   у першій версії.
2. **Approval Queue**: без ручного підтвердження система не публікує товар, не змінює
   ціну, не активує рекламу, не замовляє товар у постачальника, не використовує
   ризикові claims і не відповідає клієнту щодо повернення коштів.
3. **Shopify — лише GraphQL Admin API** (REST — legacy). Версія API в конфігурації;
   станом на липень 2026 стабільна версія — `2026-07`.
4. **Створення товару — кілька операцій**: `productCreate` створює товар із початковим
   варіантом; додаткові варіанти — через bulk mutation; media — асинхронно.
5. **Webhooks замість polling** для замовлень/оновлень/fulfillment: перевірка підпису,
   збереження події (event inbox), захист від повторної обробки.
6. **Meta-публікація відділена від дослідження конкурентів**: окремий adapter для
   власних кампаній/креативів/insights, окремий — для імпорту досліджень.

## Основні модулі

### Creative Factory
З одного товару: Product Intelligence Brief, портрети аудиторій, рекламні кути,
12–24 hooks, primary texts і headlines, 6 статичних креативів, 3 каруселі,
3 відеокреативи, UGC-сценарії, озвучення та субтитри, compliance-звіт, назви
файлів і UTM-структура. Відео — Remotion + FFmpeg; статика — React templates + Sharp.
Формати: 9:16, 4:5, 1:1; відео 10/15/20/30 c, 1080×1920, 1080×1350, 1080×1080.
Заборонено: фейкові reviews/testimonials, medical claims.

### Product Research
Score 0–100 за: тривалість реклами, кількість активних креативів, visual demo
potential, маржинальність, офер, якість сторінки, доставка, насиченість ринку,
policy risk, copyright risk. Нижче 65 або з критичними red flags — авто-відхилення.

### Product Page Builder
Після підтвердження: title/subtitle, benefit bullets, description, характеристики,
FAQ, SEO, alt text, metafields, варіанти, ціни, collections, Shopify Product Draft.

### Supplier Monitor
За графіком: ціна постачальника, залишки, доступність варіантів, термін доставки,
зміна маржі. Небезпечна зміна → alert + approval task (без тихих змін магазину).

### Order Routing
```
Shopify order webhook → перевірка підпису й дубля → перевірка оплати, адреси,
товару та маржі → Supplier Order Draft → підтвердження → замовлення постачальнику
→ tracking → Shopify fulfillment
```
Перший adapter — **ManualSupplierAdapter**: готує всі дані, замовлення оформлюється вручну.

### Analytics Feedback Loop
Кожен креатив повʼязується з товаром, angle, hook, форматом, Meta creative ID,
ad ID, spend, CTR, CPA, ROAS і фактичним прибутком. Після накопичення даних —
завдання на ітерацію переможних креативів.

## Технологічний стек

TypeScript (strict), Node.js LTS, pnpm, Turborepo, Next.js App Router, PostgreSQL,
Prisma, Redis, BullMQ, Zod, Tailwind CSS, shadcn/ui, S3-compatible storage (MinIO
локально), Remotion, FFmpeg, Sharp, Playwright, Vitest, Docker Compose.

## Структура monorepo

```
apps/        web/  worker/  render-worker/
packages/    db/  domain/  integrations/  contracts/  templates/  ui/  config/
             observability/  test-utils/
infra/
docs/
```

## Архітектурні правила

1. Бізнес-логіка не в React components.
2. Domain packages не залежать від Next.js.
3. Інтеграції — через adapter interfaces.
4. AI-логіка не привʼязана до одного провайдера.
5. Усі зовнішні payloads — через Zod.
6. Shopify GraphQL operations — у versioned `.graphql` files.
7. Не вгадувати Shopify mutations/fields/topics/scopes — перевіряти документацію.
8. Shopify API version — в environment configuration.
9. Усі background jobs — idempotent.
10. Retry, timeout, exponential backoff, dead-letter behavior.
11. Не приховувати errors.
12. Без `any` (крім ізольованих SDK boundaries).
13. Без secrets/PII у logs.
14. AI/Shopify/Meta/supplier API — ніколи з browser.
15. Live publish і фінансові операції — лише через approval.

## Approval-first policy

Ручне підтвердження обовʼязкове для: публікації Shopify product, зміни retail price,
вимкнення товару/варіанта, створення supplier order, активації Meta ads, high-risk
claims, refund promise, third-party copyrighted assets.
Shopify products за замовчуванням — **Draft**; Meta campaigns/ad sets/ads — **Paused**;
у development — заборонено створювати реальні supplier orders.

## AI providers

Інтерфейси `TextGenerationProvider` (structured JSON + Zod), `ImageGenerationProvider`,
`TextToSpeechProvider`, `VideoGenerationProvider`. Спочатку mock providers; реальні —
окремими adapters. Prompts — versioned.

## Безпека

Encrypted integration tokens, encrypted customer shipping address, signed asset URLs,
masking logs, RBAC, CSRF protection, rate limiting, webhook signature verification,
audit logs, валідація типу/розміру файлів, окремі dev/staging/prod secrets.

## Порядок реалізації (milestones)

| Milestone | Обсяг |
| --------- | ----- |
| **M0** | Monorepo, Docker Compose (PostgreSQL/Redis/MinIO), Prisma, env validation, health endpoints, lint/typecheck/test/E2E setup, CI, README, `.env.example` |
| **M1** | Core domain: users, stores, product candidates, products, assets, approvals, audit logs, domain events, outbox, BullMQ infrastructure, basic dashboard, seed data |
| **M2** | Candidate import (manual + URL abstraction), Product Intelligence, Product Score, pricing calculator, break-even CPA/ROAS, prompt versioning, mock AI provider, compliance rules |
| **M3** | Creative Factory: briefs, batches, concepts, asset upload, static templates, render jobs, Remotion template, FFmpeg processing, previews, approval, export |
| **M4** | Shopify adapter, Shopify Product Draft publishing |
| **M5** | Order webhook, order state machine, ManualSupplierAdapter, price/stock snapshots, alerts |
| **M6** | Analytics, contribution margin, creative iteration briefs |
| **M7 (optional)** | Meta Marketing API integration — після стабільного Shopify flow |

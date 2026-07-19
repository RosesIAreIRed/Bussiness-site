# ORmilo Growth OS
## Технічне завдання та архітектура системи автоматизації креативів і Shopify-дропшипінгу

**Формат продукту:** внутрішній вебзастосунок для одного Shopify-магазину з можливістю подальшого переходу до multi-store SaaS.  
**Основний принцип:** жодна ризикована дія не виконується без підтвердження користувача. Товари створюються як Draft, рекламні кампанії — як Paused, замовлення постачальнику — через контрольовану чергу.

---

# 1. Мета системи

Створити єдину операційну систему для Shopify-дропшипінгу, яка закриває цикл:

1. Додавання потенційного товару.
2. Аналіз товару, ринку, офера та ризиків.
3. Генерація сторінки товару.
4. Генерація пакетів рекламних креативів.
5. Публікація товару в Shopify як чернетки.
6. Передавання затверджених креативів у рекламний кабінет або експорт.
7. Збір результатів реклами та продажів.
8. Автоматична генерація нових варіацій на основі реальних метрик.
9. Контроль ціни, залишків і доставки постачальника.
10. Обробка замовлень і трекінгу.

Робоча назва системи: **Ormilo Growth OS**.

---

# 2. Що саме автоматизувати

## 2.1. Creative Factory

Модуль створює рекламні матеріали з інформації про товар, фотографій, відеокліпів, відгуків і бренд-гайду.

### Вхідні дані

- URL сторінки постачальника або конкурента.
- URL товару Shopify.
- Завантажені фотографії та відео.
- Назва товару.
- Собівартість.
- Ціна продажу.
- Цільова країна.
- Цільова аудиторія.
- Бренд-гайд: кольори, шрифти, логотип, tone of voice.
- Заборонені слова та твердження.
- Переваги товару.
- Технічні характеристики.
- Реальні відгуки, які користувач має право використовувати.
- Докази: сертифікати, гарантія, доставка, повернення.

### Етапи роботи

1. Система імпортує текст і медіафайли.
2. Нормалізує дані та видаляє дублікати.
3. AI формує Product Intelligence Brief:
   - що це за товар;
   - яку проблему вирішує;
   - для кого;
   - головні переваги;
   - заперечення покупця;
   - докази;
   - ризикові або непідтверджені твердження;
   - можливі рекламні кути.
4. Система створює Creative Matrix.
5. Користувач обирає концепції.
6. Система генерує тексти, макети, сценарії та відео.
7. Compliance Guard перевіряє твердження.
8. Креативи переходять у Review.
9. Після підтвердження їх можна:
   - завантажити;
   - відправити в Google Drive;
   - прикріпити до товару;
   - створити як Paused creatives/ads у Meta;
   - передати у монтажну чергу.

### Creative Matrix

За замовчуванням система створює:

- 6 рекламних кутів;
- 4 hooks для кожного кута;
- 3 варіанти primary text;
- 3 headlines;
- 2 CTA;
- 3 формати: 9:16, 4:5, 1:1.

Базові кути:

1. Problem → Solution.
2. Product Demonstration.
3. Before → After, лише без оманливих результатів.
4. Objection Handling.
5. Comparison.
6. Lifestyle/Identity.
7. Gift angle.
8. Offer/Urgency.
9. Founder/Brand Story.
10. FAQ/Explainer.

### Вихід одного Creative Batch

- `product_brief.json`;
- `creative_matrix.json`;
- 12–24 hooks;
- 6 статичних макетів;
- 3 каруселі;
- 3 коротких відео;
- 3 UGC-сценарії;
- 3 voice-over scripts;
- subtitles `.srt`;
- captions і headlines;
- назви файлів за єдиною UTM-конвенцією;
- звіт про ризикові claims;
- estimated generation cost.

### Генерація статичних креативів

Система повинна підтримувати шаблони:

- product hero;
- problem/solution;
- feature callouts;
- review card;
- comparison;
- offer;
- bundle;
- FAQ;
- advertorial-style;
- minimal premium.

Технічна реалізація:

- React/HTML templates;
- рендер через Playwright або Satori;
- обробка зображень через Sharp;
- автоматичне кадрування;
- видалення фону через provider adapter;
- автоматичне розміщення логотипа;
- safe zones для Meta/TikTok;
- експорт PNG/JPEG/WebP.

### Генерація відео

Відео збирається з:

- завантажених користувачем кліпів;
- ліцензованих stock-кліпів;
- AI-generated B-roll;
- product images;
- текстових сцен;
- voice-over;
- музики, на яку є права;
- subtitles.

Технічна реалізація:

- Remotion для шаблонного відео;
- FFmpeg для transcoding, audio mixing, normalization і фінального export;
- Sharp для підготовки кадрів;
- TTS через адаптер;
- AI video через окремий provider adapter;
- обмеження тривалості: 10, 15, 20, 30 секунд;
- output: MP4 H.264, AAC;
- формати: 1080×1920, 1080×1350, 1080×1080.

### Важливі правила

- Не копіювати креатив конкурента один в один.
- Не створювати фейкові відгуки.
- Не створювати фейковий UGC від нібито реального покупця.
- Не використовувати медичні claims без доказів.
- Не використовувати чужі фото або відео без дозволу.
- Не публікувати автоматично без Approval.
- Зберігати джерело кожного asset.

---

## 2.2. Product Research Automation

Мета — збирати товари-кандидати та оцінювати їх за єдиною системою.

### Джерела

- ручне додавання URL;
- CSV import;
- Shopify/DTC landing pages;
- supplier APIs;
- browser extension “Save candidate”;
- дозволені third-party ad intelligence APIs;
- Meta Ad Library через browser-assisted capture або легальний connector;
- TikTok Creative Center через дозволений connector;
- Google Trends connector;
- власна база попередніх досліджень.

Не будувати MVP навколо крихкого scraper, який обходить login, CAPTCHA або обмеження платформи.

### Поля Product Candidate

- product name;
- store name;
- store URL;
- product URL;
- supplier URL;
- ad library URL;
- first seen date;
- ad start date;
- estimated days running;
- active creative count;
- creative formats;
- hooks;
- selling price;
- compare-at price;
- offer;
- estimated cost;
- shipping estimate;
- gross margin;
- visual demo potential;
- trust signals;
- reviews count;
- red flags;
- policy risk;
- copyright risk;
- saturation score;
- final score;
- decision: Reject / Watch / Test / Winner.

### Система оцінки 0–100

- Ad longevity — 15.
- Кількість креативних варіацій — 10.
- Visual demo potential — 15.
- Gross margin — 15.
- Landing page quality — 10.
- Offer strength — 10.
- Fulfillment quality — 10.
- Trust and reviews — 5.
- Product differentiation — 10.

Штрафи:

- policy risk: до -25;
- copyright/trademark risk: до -30;
- fragile or expensive shipping: до -15;
- unrealistic claims: до -20;
- weak supplier reliability: до -20;
- saturated commodity: до -15.

Товар допускається до тесту лише при score ≥ 65 і відсутності критичного red flag.

### Автоматичні результати аналізу

- короткий висновок;
- чому товар може продаватися;
- чому може провалитися;
- рекомендована ціна;
- break-even CPA;
- рекомендований офер;
- 5 advertising angles;
- 10 hooks;
- список матеріалів, яких бракує;
- рішення: reject/watch/test.

---

## 2.3. Product Page Builder

Після затвердження Product Candidate система створює Product Draft.

### Генерований контент

- title;
- subtitle;
- one-line value proposition;
- benefit bullets;
- product description;
- specifications;
- how to use;
- what is included;
- shipping information;
- returns information;
- warranty;
- FAQ;
- SEO title;
- SEO description;
- image alt text;
- product tags;
- product type;
- vendor;
- collections;
- metafields/metaobjects;
- structured comparison data;
- reusable page sections.

### Shopify flow

1. Створити товар у статусі Draft.
2. Завантажити media.
3. Створити options.
4. Створити variants.
5. Записати pricing.
6. Записати SKU.
7. Прив’язати supplier mapping.
8. Записати metafields.
9. Додати до collection.
10. Показати preview.
11. Дозволити Publish лише після ручного підтвердження.

### Автоматичне ціноутворення

Вхід:

- supplier cost;
- shipping cost;
- payment fee;
- Shopify fee;
- target gross margin;
- refund reserve;
- ad cost reserve;
- currency conversion;
- VAT/tax reserve, якщо застосовується.

Вихід:

- minimum viable price;
- recommended price;
- compare-at price;
- bundle price;
- break-even CPA;
- break-even ROAS.

Формула break-even ROAS:

`Break-even ROAS = Revenue / Contribution margin before ads`

або

`Break-even ROAS = 1 / Contribution margin ratio`

---

## 2.4. Supplier Price and Stock Monitor

### Функції

- перевірка supplier price;
- перевірка stock;
- перевірка variant availability;
- перевірка estimated delivery;
- порівняння з останнім snapshot;
- розрахунок нової маржі;
- alert при небезпечній зміні;
- можливість поставити товар у Draft;
- можливість приховати out-of-stock variant;
- черга ручного підтвердження зміни ціни.

### Правила

- Не змінювати retail price автоматично більше ніж на заданий відсоток.
- Не вимикати весь товар без повідомлення.
- Не створювати замовлення постачальнику, якщо ціна перевищила допустиму.
- Зберігати історію supplier price.
- Кожна перевірка має retry і timeout.

---

## 2.5. Order Routing and Fulfillment

### Потік

1. Shopify надсилає webhook про нове замовлення.
2. Webhook перевіряється за підписом.
3. Подія записується в БД.
4. Перевіряється idempotency.
5. Замовлення отримує статус `RECEIVED`.
6. Система перевіряє:
   - payment status;
   - shipping address;
   - duplicate order;
   - product-to-supplier mapping;
   - current supplier stock;
   - current cost;
   - margin guard;
   - risk flags.
7. Якщо все добре — створюється Supplier Order Draft.
8. Користувач підтверджує оплату/відправлення або дозволяє auto-route для low-risk orders.
9. Supplier adapter створює замовлення.
10. Supplier order ID записується.
11. Система періодично перевіряє tracking.
12. Tracking передається в Shopify.
13. Покупець отримує стандартне повідомлення Shopify.

### Статуси

- RECEIVED
- VALIDATING
- NEEDS_REVIEW
- READY_TO_ROUTE
- ROUTING
- ROUTED
- TRACKING_PENDING
- FULFILLED
- CANCELLED
- FAILED
- DEAD_LETTER

### Supplier Adapter Interface

```ts
export interface SupplierAdapter {
  getProduct(input: { url?: string; externalId?: string }): Promise<SupplierProduct>;
  getPrice(input: { externalVariantId: string }): Promise<Money>;
  getInventory(input: { externalVariantId: string }): Promise<InventoryResult>;
  createOrder(input: SupplierOrderInput): Promise<SupplierOrderResult>;
  getOrder(input: { externalOrderId: string }): Promise<SupplierOrderResult>;
  getTracking(input: { externalOrderId: string }): Promise<TrackingResult>;
  cancelOrder?(input: { externalOrderId: string }): Promise<CancelResult>;
}
```

Перший adapter може бути `ManualSupplierAdapter`, який не відправляє реальне замовлення, а створює task з усіма даними для ручного оформлення.

---

## 2.6. Customer Support Assistant

### Функції

- визначення типу звернення;
- пошук замовлення;
- перевірка tracking;
- генерація чернетки відповіді;
- FAQ retrieval;
- escalation;
- sentiment;
- шаблони refund/replacement/delay;
- заборона самостійно обіцяти refund або компенсацію.

### Категорії

- where is my order;
- change address;
- cancel order;
- damaged item;
- refund request;
- wrong product;
- product question;
- payment issue;
- spam.

На першому етапі система лише створює draft відповіді.

---

## 2.7. Analytics and Feedback Loop

### Дані

Shopify:

- sessions;
- add to cart;
- checkout;
- orders;
- revenue;
- AOV;
- refund;
- product conversion;
- repeat purchase.

Meta:

- spend;
- impressions;
- CPM;
- CTR;
- CPC;
- purchases;
- CPA;
- ROAS;
- video views;
- hook/hold metrics, якщо доступні;
- creative/ad/campaign IDs.

Внутрішні:

- COGS;
- shipping;
- payment fees;
- refunds reserve;
- contribution margin;
- profit after ads;
- creative generation cost.

### Creative Feedback Loop

1. Sync metrics.
2. Прив’язати ad ID до Creative Asset.
3. Дочекатися minimum spend threshold.
4. Визначити:
   - winning hook;
   - winning angle;
   - winning format;
   - слабке місце.
5. AI створює iteration brief:
   - зберегти hook, змінити body;
   - зберегти body, змінити offer;
   - створити новий first frame;
   - скоротити відео;
   - змінити CTA.
6. Новий batch потрапляє у Review.
7. Автоматична активація реклами заборонена в MVP.

---

# 3. Архітектурний підхід

## 3.1. Не мікросервіси

Для MVP використовувати **modular monolith + background workers**.

Причини:

- швидше реалізувати;
- простіше дебажити;
- менше DevOps;
- одна база даних;
- можна винести render worker або scraping worker пізніше.

## 3.2. Технологічний стек

### Основний стек

- TypeScript.
- Node.js LTS.
- pnpm.
- Turborepo.
- Next.js App Router для web UI і server routes.
- PostgreSQL.
- Prisma ORM.
- Redis.
- BullMQ.
- Zod.
- Tailwind CSS.
- shadcn/ui.
- S3-compatible object storage.
- MinIO у local development.
- Remotion.
- FFmpeg.
- Sharp.
- Playwright.
- Vitest.
- Playwright E2E.
- Docker Compose.
- OpenTelemetry або Sentry для errors/observability.

### AI abstraction

Не прив’язувати доменну логіку до одного AI-провайдера.

```ts
export interface TextGenerationProvider {
  generateStructured<T>(input: {
    systemPrompt: string;
    userPrompt: string;
    schema: unknown;
    model?: string;
  }): Promise<T>;
}

export interface ImageGenerationProvider {
  generate(input: ImageGenerationInput): Promise<GeneratedAsset[]>;
}

export interface TextToSpeechProvider {
  synthesize(input: TtsInput): Promise<GeneratedAudio>;
}

export interface VideoGenerationProvider {
  generate(input: VideoGenerationInput): Promise<GeneratedVideo>;
}
```

У конфігурації можна обрати provider окремо для text, image, video і TTS.

---

# 4. Загальна схема

```text
User
  |
  v
Next.js Web UI
  |
  v
Application/API Layer
  |---------------------> PostgreSQL
  |---------------------> Redis/BullMQ
  |---------------------> S3/MinIO
  |
  +--> Shopify Adapter
  +--> Supplier Adapters
  +--> AI Provider Adapters
  +--> Meta Marketing Adapter
  +--> Research Source Adapters

Shopify Webhooks
  |
  v
Webhook Gateway
  |
  v
Event Inbox + Idempotency
  |
  v
BullMQ Jobs
  |
  v
Domain Handlers / Workers
```

---

# 5. Структура monorepo

```text
ormilo-growth-os/
  apps/
    web/
      app/
      components/
      server/
      routes/
    worker/
      src/
        jobs/
        processors/
        schedulers/
    render-worker/
      src/
        remotion/
        ffmpeg/
  packages/
    db/
      prisma/
      src/
    domain/
      products/
      research/
      creatives/
      orders/
      suppliers/
      analytics/
      approvals/
    integrations/
      shopify/
      meta/
      suppliers/
      storage/
      ai/
      email/
    contracts/
      schemas/
      events/
      api/
    templates/
      static/
      video/
      prompts/
    ui/
    config/
    observability/
    test-utils/
  infra/
    docker/
    scripts/
  docs/
    architecture.md
    setup.md
    api.md
    workflows.md
    security.md
  .env.example
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  turbo.json
```

---

# 6. Головні модулі

## 6.1. Identity and Store Connection

MVP — single tenant.

Зберігати:

- store domain;
- encrypted Shopify token;
- API version;
- store currency;
- timezone;
- location IDs;
- publication IDs;
- brand settings.

Токен ніколи не передавати в browser і не писати в logs.

## 6.2. Product Intelligence

Відповідає за:

- import;
- normalization;
- extraction;
- claims;
- personas;
- hooks;
- scoring;
- pricing.

## 6.3. Creative Orchestrator

Відповідає за:

- batch creation;
- concept generation;
- template selection;
- asset jobs;
- render jobs;
- compliance;
- approval;
- export.

## 6.4. Shopify Publisher

Відповідає за:

- product draft;
- variants;
- media;
- metafields;
- collections;
- preview;
- publish.

Усі GraphQL operations зберігати у versioned `.graphql` files.

## 6.5. Automation Engine

Automation складається з:

- trigger;
- conditions;
- actions;
- approval policy;
- retry policy;
- notification policy.

Приклад:

```json
{
  "name": "Low stock guard",
  "trigger": {
    "type": "schedule",
    "cron": "0 */6 * * *"
  },
  "conditions": [
    {
      "field": "supplier.inventory",
      "operator": "lte",
      "value": 5
    }
  ],
  "actions": [
    {
      "type": "CREATE_ALERT"
    },
    {
      "type": "QUEUE_SHOPIFY_VARIANT_REVIEW"
    }
  ],
  "approvalMode": "MANUAL"
}
```

---

# 7. Модель даних

## Обов’язкові таблиці

### users

- id
- email
- name
- role
- created_at
- updated_at

### stores

- id
- name
- shop_domain
- encrypted_access_token
- api_version
- currency
- timezone
- settings_json

### product_candidates

- id
- source_type
- source_url
- supplier_url
- store_url
- ad_library_url
- title
- raw_data_json
- normalized_data_json
- score
- decision
- red_flags_json
- status
- created_at

### products

- id
- store_id
- candidate_id
- shopify_product_gid
- title
- handle
- status
- pricing_json
- content_json
- supplier_mapping_json
- created_at
- updated_at

### product_variants

- id
- product_id
- shopify_variant_gid
- sku
- option_values_json
- price
- compare_at_price
- supplier_variant_id
- supplier_cost
- stock_snapshot

### creative_briefs

- id
- product_id
- version
- input_json
- output_json
- claims_json
- status

### creative_batches

- id
- product_id
- brief_id
- status
- requested_outputs_json
- generation_cost
- created_at

### creative_concepts

- id
- batch_id
- angle
- hook
- script_json
- copy_json
- score
- status

### assets

- id
- product_id
- concept_id
- type
- source
- source_url
- storage_key
- mime_type
- width
- height
- duration_ms
- checksum
- license_json
- metadata_json

### render_jobs

- id
- concept_id
- template_id
- status
- input_json
- output_asset_id
- error_json
- attempts

### approvals

- id
- entity_type
- entity_id
- action
- status
- requested_by
- decided_by
- comment
- created_at
- decided_at

### supplier_snapshots

- id
- supplier_product_id
- price
- inventory
- shipping_json
- captured_at

### orders

- id
- store_id
- shopify_order_gid
- shopify_order_name
- status
- financial_status
- fulfillment_status
- totals_json
- shipping_address_encrypted
- created_at

### supplier_orders

- id
- order_id
- supplier
- external_order_id
- status
- cost
- tracking_json
- raw_response_encrypted

### webhook_events

- id
- provider
- external_event_id
- topic
- payload_json
- signature_valid
- status
- received_at
- processed_at
- error_json

### metric_snapshots

- id
- provider
- entity_type
- entity_id
- date
- metrics_json

### automation_runs

- id
- automation_id
- trigger_json
- status
- started_at
- finished_at
- log_json

### prompt_versions

- id
- key
- version
- system_prompt
- user_template
- schema_json
- active

### audit_logs

- id
- actor_type
- actor_id
- action
- entity_type
- entity_id
- metadata_json
- created_at

---

# 8. Domain events

```ts
type DomainEvent =
  | { type: "ProductCandidateImported"; candidateId: string }
  | { type: "ProductAnalysisRequested"; candidateId: string }
  | { type: "ProductAnalysisCompleted"; candidateId: string }
  | { type: "CreativeBatchRequested"; batchId: string }
  | { type: "CreativeConceptGenerated"; conceptId: string }
  | { type: "AssetRenderRequested"; renderJobId: string }
  | { type: "AssetRendered"; assetId: string }
  | { type: "ApprovalRequested"; approvalId: string }
  | { type: "ProductDraftPushRequested"; productId: string }
  | { type: "ShopifyProductDraftCreated"; productId: string }
  | { type: "ShopifyOrderReceived"; orderId: string }
  | { type: "SupplierOrderRequested"; supplierOrderId: string }
  | { type: "TrackingReceived"; supplierOrderId: string }
  | { type: "MetricsSyncRequested"; storeId: string };
```

Події спочатку можна зберігати через outbox table і обробляти BullMQ worker.

---

# 9. Job queues

- `research.import`
- `research.analyze`
- `product.generate-copy`
- `creative.generate-brief`
- `creative.generate-concepts`
- `creative.generate-image`
- `creative.generate-video`
- `creative.render-static`
- `creative.render-video`
- `creative.compliance-check`
- `shopify.create-product-draft`
- `shopify.upload-media`
- `shopify.sync-product`
- `supplier.sync-price-stock`
- `supplier.create-order`
- `supplier.sync-tracking`
- `analytics.sync-shopify`
- `analytics.sync-meta`
- `notifications.send`
- `maintenance.cleanup`

Для кожної queue:

- retry з exponential backoff;
- timeout;
- max attempts;
- dead-letter behavior;
- idempotency key;
- structured logs;
- cost tracking.

---

# 10. API endpoints

## Research

- `POST /api/research/candidates/import-url`
- `POST /api/research/candidates/import-csv`
- `GET /api/research/candidates`
- `GET /api/research/candidates/:id`
- `POST /api/research/candidates/:id/analyze`
- `POST /api/research/candidates/:id/decision`

## Products

- `POST /api/products/from-candidate/:candidateId`
- `GET /api/products`
- `GET /api/products/:id`
- `PATCH /api/products/:id`
- `POST /api/products/:id/generate-copy`
- `POST /api/products/:id/push-shopify-draft`
- `POST /api/products/:id/publish`
- `POST /api/products/:id/sync`

## Creatives

- `POST /api/products/:id/creative-brief`
- `POST /api/products/:id/creative-batches`
- `GET /api/creative-batches/:id`
- `POST /api/creative-concepts/:id/render`
- `POST /api/creative-assets/:id/approve`
- `POST /api/creative-assets/:id/reject`
- `POST /api/creative-batches/:id/export`
- `POST /api/creative-batches/:id/create-meta-drafts`

## Orders

- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/validate`
- `POST /api/orders/:id/route`
- `POST /api/orders/:id/retry`
- `POST /api/orders/:id/cancel-routing`

## Webhooks

- `POST /webhooks/shopify/orders-create`
- `POST /webhooks/shopify/orders-updated`
- `POST /webhooks/shopify/products-update`
- `POST /webhooks/shopify/fulfillments-update`
- `POST /webhooks/shopify/app-uninstalled`

Назви та payload конкретних webhook topics перевірити за актуальною версією Shopify API під час реалізації.

---

# 11. UI

## Dashboard

Показує:

- revenue;
- profit after variable costs;
- ad spend;
- ROAS;
- break-even ROAS;
- orders requiring attention;
- low stock;
- supplier price changes;
- creative winners;
- failed automation runs;
- pending approvals.

## Research Board

Kanban:

- Inbox.
- Analyzing.
- Watch.
- Test.
- Rejected.
- Winner.

## Product Workspace

Tabs:

- Overview.
- Supplier.
- Pricing.
- Page copy.
- Media.
- Creatives.
- Shopify.
- Metrics.
- Audit log.

## Creative Factory

- brief;
- angle selector;
- hooks;
- storyboard;
- asset picker;
- template picker;
- preview;
- render status;
- compliance report;
- approval actions;
- export.

## Orders

- new;
- needs review;
- ready;
- routed;
- tracking pending;
- fulfilled;
- failed.

## Settings

- Shopify;
- Meta;
- suppliers;
- AI providers;
- brand kit;
- generation limits;
- compliance rules;
- notifications;
- automation rules.

---

# 12. Shopify integration

## Правила

- Використовувати GraphQL Admin API.
- API version зберігати в environment/config.
- Не hardcode GIDs.
- Усі mutations мають обробляти `userErrors`.
- Використовувати cursor pagination.
- Додати rate limit handling.
- Товар завжди створювати як Draft.
- Publish — окремий approval action.
- Media upload може бути asynchronous, тому перевіряти status.
- Webhooks мають бути idempotent.

## Мінімальні операції

- отримати store metadata;
- створити product draft;
- оновити product;
- створити variants;
- завантажити files/media;
- прив’язати media;
- створити metafields;
- додати до collection;
- опублікувати після approval;
- отримати orders;
- оновити fulfillment/tracking;
- синхронізувати inventory за потреби.

## Scopes

Запитувати лише необхідні scopes. Остаточний список перевірити за актуальною схемою Shopify перед реалізацією.

Орієнтовно:

- products read/write;
- files read/write;
- inventory read/write;
- orders read;
- fulfillments read/write;
- locations read.

---

# 13. Meta integration

Meta integration — окремий optional module.

### MVP

- зберігати Meta ad account ID;
- OAuth/token setup;
- імпортувати insights;
- створювати creative/ad drafts;
- створювати все в `PAUSED`;
- не активувати без approval;
- прив’язувати `creative_asset_id` до Meta creative/ad IDs.

### Потік

1. Upload image/video.
2. Create Meta creative.
3. Create ad using creative ID.
4. Зберегти IDs.
5. Залишити Paused.
6. Показати preview/links.
7. Після ручного рішення користувач активує у Meta Ads Manager або через окрему approval action.

### Research

Не змішувати Meta publishing adapter і competitor research adapter. Це два різні джерела та різні permissions.

---

# 14. Prompt management

Усі prompts мають бути versioned.

Кожен prompt:

- key;
- version;
- system prompt;
- user template;
- JSON Schema;
- model parameters;
- examples;
- active flag;
- changelog.

AI не повинен повертати довільний текст там, де потрібні структуровані дані. Використовувати schema validation через Zod.

Приклад результату Product Brief:

```ts
const ProductBriefSchema = z.object({
  summary: z.string(),
  targetPersonas: z.array(
    z.object({
      name: z.string(),
      pains: z.array(z.string()),
      desires: z.array(z.string()),
      objections: z.array(z.string())
    })
  ),
  benefits: z.array(
    z.object({
      benefit: z.string(),
      evidence: z.string().nullable(),
      confidence: z.number().min(0).max(1)
    })
  ),
  angles: z.array(
    z.object({
      name: z.string(),
      rationale: z.string(),
      hooks: z.array(z.string())
    })
  ),
  riskyClaims: z.array(
    z.object({
      claim: z.string(),
      reason: z.string(),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"])
    })
  )
});
```

---

# 15. Compliance Guard

Compliance Guard виконується перед render і перед export/publish.

### Перевірки

- medical claims;
- guaranteed results;
- fake scarcity;
- fake review;
- unsupported statistics;
- misleading before/after;
- trademark usage;
- copyrighted characters;
- prohibited products;
- personal attributes;
- unsafe use;
- spelling;
- price mismatch;
- shipping mismatch;
- offer expiry mismatch.

### Результат

- PASS;
- PASS_WITH_WARNINGS;
- BLOCKED.

`BLOCKED` не можна approve без admin override з коментарем у audit log.

---

# 16. Security

- Secrets лише server-side.
- Encrypted tokens at rest.
- PII encryption для shipping address.
- Masking у logs.
- Role-based access.
- CSRF protection.
- Rate limiting.
- Shopify webhook signature verification.
- Meta webhook/signature verification, якщо використовується.
- Idempotency.
- Audit logs.
- Dependency scanning.
- File type and size validation.
- Antivirus scanning для uploaded files, якщо розгортання production.
- Signed URLs для assets.
- Separate dev/staging/prod credentials.
- No real supplier order from dev environment.

---

# 17. Observability

Кожен job/run повинен мати:

- correlation ID;
- entity ID;
- provider;
- attempt;
- duration;
- cost;
- input hash;
- result;
- error code;
- retry status.

Dashboard failures:

- failed jobs;
- dead-letter jobs;
- invalid webhooks;
- Shopify userErrors;
- provider timeouts;
- budget exceeded;
- asset rendering failures.

---

# 18. Cost Guardrails

- daily AI budget;
- per-batch budget;
- max image generations;
- max video generations;
- max retries;
- max input tokens;
- provider cost table;
- estimated cost before run;
- actual cost after run;
- hard stop при перевищенні ліміту.

Default MVP:

- max 6 static renders;
- max 3 video renders;
- max 24 hooks;
- max 2 image-generation retries;
- max 2 video-generation retries.

---

# 19. Approval Engine

Approval потрібен для:

- publish product;
- push retail price changes;
- disable variant;
- create supplier order;
- activate Meta campaign/ad;
- use high-risk claim;
- send refund promise;
- use third-party copyrighted media.

Approval states:

- PENDING;
- APPROVED;
- REJECTED;
- EXPIRED;
- CANCELLED.

---

# 20. MVP scope

## Входить у MVP

1. Single-store login.
2. Shopify connection.
3. Product candidate import by URL/manual form.
4. Product analysis.
5. Product scoring.
6. Product copy generation.
7. Product Draft creation in Shopify.
8. Media upload.
9. Creative brief.
10. Static template rendering.
11. Video assembly from user assets.
12. Approval queue.
13. Asset export.
14. Shopify order webhook ingestion.
15. ManualSupplierAdapter.
16. Basic supplier price/stock snapshots.
17. Dashboard.
18. Audit log.
19. Docker local setup.
20. Unit, integration і E2E tests.

## Не входить у перший MVP

- automatic Meta activation;
- autonomous product research scraping;
- real supplier purchasing without approval;
- automatic refund;
- automatic customer email sending;
- full multi-store SaaS;
- billing;
- complex team permissions;
- AI avatar testimonials;
- theme auto-publishing.

---

# 21. Етапи реалізації для Claude Code

## Milestone 0 — Repository and infrastructure

- створити monorepo;
- налаштувати lint/typecheck/test;
- Docker Compose;
- PostgreSQL;
- Redis;
- MinIO;
- Prisma;
- health endpoints;
- `.env.example`;
- CI.

Definition of Done:

- `pnpm install`;
- `docker compose up`;
- `pnpm db:migrate`;
- `pnpm dev`;
- усі services healthy.

## Milestone 1 — Core domain and UI shell

- auth;
- stores;
- products;
- candidates;
- assets;
- approvals;
- audit logs;
- dashboard shell;
- repository/service pattern;
- domain events/outbox.

## Milestone 2 — Product intelligence

- URL/manual import;
- normalized schema;
- AI provider abstraction;
- prompt versioning;
- Product Brief;
- Product Score;
- pricing calculator;
- compliance checks.

## Milestone 3 — Creative Factory

- creative batches;
- creative matrix;
- static templates;
- asset upload;
- Sharp processing;
- render queue;
- Remotion video template;
- FFmpeg output;
- previews;
- approval.

## Milestone 4 — Shopify Publisher

- store connection;
- GraphQL client;
- product draft;
- variants;
- files/media;
- metafields;
- collections;
- Shopify sync;
- preview;
- publish approval;
- webhook ingestion.

## Milestone 5 — Orders and suppliers

- order webhook;
- idempotency;
- order state machine;
- supplier adapter;
- ManualSupplierAdapter;
- price/stock monitor;
- tracking workflow;
- alerts.

## Milestone 6 — Analytics

- Shopify metrics;
- cost model;
- profit dashboard;
- creative-to-product mapping;
- CSV import for Meta metrics;
- iteration brief.

## Milestone 7 — Optional Meta adapter

- Meta account connection;
- insights sync;
- upload media;
- create creative;
- create paused ad;
- approval;
- mapping and errors.

---

# 22. Acceptance criteria

## Product

- Користувач додає URL або вручну вводить дані.
- Система створює normalized candidate.
- Система формує score і red flags.
- Після approve створюється внутрішній Product Draft.
- Після окремого approve створюється Shopify Draft.
- Повторний запуск з тим самим idempotency key не створює дубль.

## Creative

- Для товару можна створити Creative Batch.
- AI output проходить Zod validation.
- Створюються щонайменше 6 концепцій.
- Рендеряться 3 формати static.
- З user clips рендериться MP4.
- Є preview.
- Є compliance report.
- Без approval export/publish action недоступна.
- У кожного asset є source і license metadata.

## Orders

- Webhook з валідним підписом приймається.
- Дубль webhook не створює дубль order.
- Невалідний підпис відхиляється.
- Order переходить через state machine.
- ManualSupplierAdapter створює task.
- Помилки йдуть у retry/dead letter.
- Реальне замовлення не створюється в dev.

## Reliability

- всі jobs idempotent;
- retries;
- provider timeout;
- structured errors;
- audit logs;
- tests;
- no secrets in logs.

---

# 23. Тестування

## Unit tests

- scoring;
- pricing;
- break-even ROAS;
- claim rules;
- state machines;
- filename/UTM naming;
- adapters;
- schema parsing.

## Integration tests

- PostgreSQL;
- BullMQ;
- S3/MinIO;
- Shopify GraphQL mocks;
- webhook signatures;
- provider failures;
- render pipeline.

## E2E

1. Create candidate.
2. Analyze.
3. Create product.
4. Generate creative batch.
5. Render static.
6. Approve.
7. Push Shopify Draft.
8. Receive fake order webhook.
9. Create manual supplier task.

---

# 24. Environment variables

```env
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ormilo
REDIS_URL=redis://localhost:6379

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=ormilo-assets
S3_ACCESS_KEY=minio
S3_SECRET_KEY=miniosecret

SHOPIFY_SHOP_DOMAIN=
SHOPIFY_ADMIN_ACCESS_TOKEN=
SHOPIFY_API_VERSION=2026-07

TEXT_AI_PROVIDER=
TEXT_AI_API_KEY=
IMAGE_AI_PROVIDER=
IMAGE_AI_API_KEY=
VIDEO_AI_PROVIDER=
VIDEO_AI_API_KEY=
TTS_PROVIDER=
TTS_API_KEY=

META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

ENCRYPTION_KEY=
WEBHOOK_SECRET=
SENTRY_DSN=

AI_DAILY_BUDGET_USD=10
AI_CREATIVE_BATCH_BUDGET_USD=3
```

Claude Code повинен додати валідацію environment variables через Zod.

---

# 25. Вимоги до якості коду

- strict TypeScript;
- no `any`, окрім ізольованих SDK boundaries;
- dependency inversion для integrations;
- functional core, imperative shell;
- domain services без залежності від Next.js;
- GraphQL operations у файлах;
- Zod для external payloads;
- database transactions;
- idempotency keys;
- migrations;
- seed data;
- structured logs;
- documented errors;
- no silent catch;
- no swallowed promise;
- no secrets in client bundle;
- no direct provider calls from UI;
- no business logic in React components.

---

# 26. Що Claude Code має зробити перед написанням інтеграції

1. Перевірити актуальну Shopify API version.
2. Перевірити актуальні GraphQL fields/mutations.
3. Не вгадувати mutation names.
4. Перевірити webhook topics.
5. Перевірити required scopes.
6. Перевірити Meta API version і permissions.
7. Створити mocked adapters до підключення real credentials.
8. Реалізовувати по milestones.
9. Після кожного milestone запускати lint, typecheck, tests.
10. Не переходити до наступного milestone при broken build.

---

# 27. Критичні обмеження

- Не обходити CAPTCHA, login або platform protections.
- Не зберігати card/payment data.
- Не створювати фейкові reviews.
- Не генерувати claims, які відсутні у source data.
- Не копіювати competitor creative.
- Не робити live publish за замовчуванням.
- Не робити supplier purchase без approval у MVP.
- Не активувати ads автоматично.
- Не запускати browser automation проти сайту, якщо це порушує його правила.
- Не змішувати production і development credentials.

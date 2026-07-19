# Assumptions (припущення)

Фіксуються під час розробки; кожне можна переглянути. Формат: A# — припущення → наслідок.

- **A1. ~~Повне ТЗ відсутнє в repository~~ — ЗАКРИТО.** Повне ТЗ додано:
  `docs/ormilo_growth_os_technical_spec_ua.md` — єдине джерело вимог. Milestone 0
  було збудовано за брифом; при звірці розбіжності усунено (див. A16), бриф
  переведено в архівний статус.
- **A2. Консервативні мажорні версії.** На момент старту доступні новіші мажори
  (Next 16, Prisma 7, TypeScript 7, ESLint 10, Vitest 4). Свідомо зафіксовано
  перевірені стабільні лінійки: **TypeScript 5.9, Next 15.5, Prisma 6.19, ESLint 9,
  Vitest 3, Zod 4, Tailwind 4, BullMQ 5, Turbo 2**. Причина: production-oriented
  ядро на LTS-екосистемі; апгрейд мажорів — окремою задачею після M1 (кожен мажор
  окремим PR із зеленим CI).
- **A3. Наявний `index.html`** (статичний сайт «ДИМ МОРОЗИВА») не стосується Ormilo
  Growth OS. Не видалявся і не змінювався; винесення/видалення — рішення власника repo.
- **A4. pnpm catalog** використовується для узгодження версій спільних devDeps
  (typescript, zod, vitest, @types/node) між пакетами.
- **A5. Семантика health-ендпоінтів:** `200 ok` / `503 degraded` (readiness).
  Web-застосунок при цьому завжди відповідає валідним JSON `HealthReport`.
- **A6. Docker недоступний у середовищі розробки цієї сесії** (daemon не запущено),
  тому `infra/docker-compose.yml` перевірено синтаксично (`docker compose config`),
  а повна перевірка стека — локально розробником або в CI із services.
- **A7. Обсяг інтерфейсів інтеграцій у M0.** AI provider interfaces (з брифу)
  визначені в `@ormilo/integrations` уже в M0 як контракти; mock-реалізації — M2;
  `SupplierAdapter` і Shopify adapter — у своїх milestones (M5/M4), щоб не плодити
  порожні заглушки.
- **A8. Prisma schema в M0** містить лише технічну модель `SystemHeartbeat`
  (смок міграційного циклу); доменні моделі — M1. Первинна міграція створюється
  розробником локально при піднятій БД: `pnpm db:migrate`.
- **A9. Дублювання bootstrap-коду worker-ів** (worker / render-worker) свідоме:
  екстракція спільного runtime — після появи третього worker-а або ускладнення
  bootstrap (правило трьох).
- **A10. Автентифікація/RBAC відсутні в M0** — зʼявляються в M1 разом із users.
  До того dashboard не містить чутливих даних і не виконує дій.
- **A11. Локаль UI — українська**; коди/ідентифікатори — англійською.
- **A12. Node.js 22 LTS** (`engines: >=22.12`), пакетний менеджер pnpm 10
  (зафіксовано через `packageManager`).
- **A13. Redis-перевірка з web** виконується ephemeral-підключенням на запит
  (web не тримає постійного зʼєднання з чергами — це роль worker-ів).
- **A14. E2E у CI** запускаються без піднятої БД/Redis: тест health-ендпоінта
  приймає обидва валідні стани (200 ok / 503 degraded) і валідує контракт звіту.
  E2E з повною інфраструктурою — після M1 (CI services).
- **A15. `NODE_ENV` ≠ середовище деплою.** Next.js примусово ставить
  `NODE_ENV=production` у `next build`/`next start` навіть локально, тому
  production-guard-и (заборона дефолтних секретів; згодом — заборона supplier
  orders поза production) керуються окремою змінною **`APP_ENV`**
  (development | test | staging | production, дефолт development).
  `NODE_ENV` використовується лише для runtime-оптимізацій фреймворків.
- **A16. Звірка M0 із повним ТЗ (після його додавання).** Приведено у відповідність:
  `docker-compose.yml` перенесено в корінь (структура §5, DoD §21 M0); env-схему
  розширено до повного переліку §24 (APP_URL, SHOPIFY_SHOP_DOMAIN/ADMIN_ACCESS_TOKEN,
  TEXT/IMAGE/VIDEO/TTS AI provider vars, META_*, ENCRYPTION_KEY, WEBHOOK_SECRET,
  SENTRY_DSN, AI-бюджети §18); S3-змінні перейменовано за ТЗ (`S3_BUCKET`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`). Свідомі відхилення від §24-шаблону:
  (1) креденшели в дефолтах — `ormilo`/`ormilo-dev-secret`, узгоджені з
  docker-compose.yml (у ТЗ — плейсхолдери `postgres`/`minio`); (2) додаткові змінні
  поверх §24: `APP_ENV` (див. A15), `LOG_LEVEL`, порти health-серверів; (3)
  `ENCRYPTION_KEY` — 64 hex (AES-256-GCM), обовʼязковий при APP_ENV=production.

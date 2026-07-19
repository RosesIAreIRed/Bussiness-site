# infra/

Local development інфраструктура (Docker Compose):

| Сервіс     | Порт      | Призначення                        |
| ---------- | --------- | ---------------------------------- |
| PostgreSQL | 5432      | Основна БД (Prisma)                |
| Redis      | 6379      | Черги BullMQ                       |
| MinIO      | 9000/9001 | S3-сумісне сховище asset-ів (API / консоль) |

```bash
pnpm infra:up      # старт
pnpm infra:down    # зупинка (volumes зберігаються)
```

Дефолтні облікові дані збігаються з `.env.example` і призначені лише для
local development. Bucket `ormilo-assets` створюється автоматично
сервісом `minio-init`.

Продакшн-деплой (Dockerfiles для web/worker/render-worker, окремі секрети,
міграційний pipeline) — окремий етап після Milestone 1.

# infra/

Compose-файл local development лежить у **корені репозиторію**
(`docker-compose.yml`) — відповідно до структури ТЗ (§5) і Definition of Done
Milestone 0 (`docker compose up`).

| Сервіс     | Порт      | Призначення                                 |
| ---------- | --------- | ------------------------------------------- |
| PostgreSQL | 5432      | Основна БД (Prisma)                         |
| Redis      | 6379      | Черги BullMQ                                |
| MinIO      | 9000/9001 | S3-сумісне сховище asset-ів (API / консоль) |

```bash
docker compose up -d     # старт (або pnpm infra:up)
docker compose down      # зупинка, volumes зберігаються (або pnpm infra:down)
```

Дефолтні облікові дані збігаються з `.env.example` і призначені лише для
local development. Bucket `ormilo-assets` створюється автоматично
сервісом `minio-init`.

Цей каталог за ТЗ (§5) призначений для `docker/` (Dockerfiles) та `scripts/`
(допоміжні скрипти) — зʼявляться на етапі підготовки deploy після Milestone 1.

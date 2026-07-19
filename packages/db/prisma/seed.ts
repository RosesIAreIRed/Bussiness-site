import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@ormilo/domain';

/**
 * Seed data (ТЗ §25). Створює адміністратора та demo-кандидата (поза production).
 * Запуск: pnpm db:seed (потрібна піднята БД і застосовані міграції).
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const appEnv = process.env.APP_ENV ?? 'development';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@ormilo.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ormilo-admin-dev';

  if (appEnv === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error('У production SEED_ADMIN_PASSWORD має бути задано явно');
  }

  try {
    const passwordHash = await hashPassword(password);
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: 'Admin', role: 'ADMIN', passwordHash },
    });
    process.stdout.write(`Seed: адміністратор ${admin.email} (роль ${admin.role})\n`);

    if (appEnv !== 'production') {
      const candidates = await prisma.productCandidate.count();
      if (candidates === 0) {
        const demo = await prisma.productCandidate.create({
          data: {
            sourceType: 'MANUAL',
            title: 'Demo: Портативний блендер для смузі',
            sourceUrl: 'https://example.com/supplier/portable-blender',
            rawDataJson: { note: 'Демонстраційний кандидат із seed data' },
          },
        });
        process.stdout.write(`Seed: demo-кандидат "${demo.title}"\n`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
  process.stderr.write(`Seed завершився з помилкою: ${message}\n`);
  process.exit(1);
});

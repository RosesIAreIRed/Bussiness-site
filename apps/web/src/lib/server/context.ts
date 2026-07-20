import { loadEnv, type Env } from '@ormilo/config';
import {
  createPrismaClient,
  createTxRepos,
  createUnitOfWork,
  createUserRepository,
  type PrismaClient,
} from '@ormilo/db';
import {
  ApprovalService,
  CandidateAnalysisService,
  CandidateService,
  type TxRepos,
  type UserRepository,
} from '@ormilo/domain';

/**
 * Композиційний корінь web-процесу: services/repos збираються тут,
 * React-компоненти отримують готові обʼєкти (ТЗ §25: без бізнес-логіки в UI).
 * Кешується в globalThis, щоб dev hot reload не плодив пул зʼєднань.
 */
export interface AppContext {
  env: Env;
  prisma: PrismaClient;
  /** Репозиторії для читань поза транзакціями (сторінки, дашборд). */
  readRepos: TxRepos;
  users: UserRepository;
  candidateService: CandidateService;
  approvalService: ApprovalService;
  analysisService: CandidateAnalysisService;
}

const globalCache = globalThis as unknown as { __ormiloContext?: AppContext };

export function getAppContext(): AppContext {
  if (!globalCache.__ormiloContext) {
    const env = loadEnv();
    const prisma = createPrismaClient({ databaseUrl: env.DATABASE_URL });
    const uow = createUnitOfWork(prisma);

    globalCache.__ormiloContext = {
      env,
      prisma,
      readRepos: createTxRepos(prisma),
      users: createUserRepository(prisma),
      candidateService: new CandidateService(uow),
      approvalService: new ApprovalService(uow),
      analysisService: new CandidateAnalysisService(uow),
    };
  }
  return globalCache.__ormiloContext;
}

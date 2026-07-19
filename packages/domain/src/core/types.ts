/**
 * Доменні типи Milestone 1 (ТЗ §7). Літерали значень збігаються з Prisma-enum-ами,
 * тому Prisma-моделі структурно сумісні з доменними типами без мапперів,
 * а domain-пакет не залежить від @prisma/client.
 */

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/** Аутентифікований актор дії (для audit та RBAC-перевірок). */
export interface Actor {
  userId: string;
  role: UserRole;
}

export type CandidateSourceType = 'MANUAL' | 'URL' | 'CSV' | 'EXTENSION' | 'API' | 'OTHER';
export type CandidateStatus = 'INBOX' | 'ANALYZING' | 'WATCH' | 'TEST' | 'REJECTED' | 'WINNER';
export type CandidateDecision = 'REJECT' | 'WATCH' | 'TEST' | 'WINNER';

export interface ProductCandidate {
  id: string;
  sourceType: CandidateSourceType;
  sourceUrl: string | null;
  supplierUrl: string | null;
  storeUrl: string | null;
  adLibraryUrl: string | null;
  title: string;
  score: number | null;
  decision: CandidateDecision | null;
  status: CandidateStatus;
  createdAt: Date;
}

export interface NewCandidate {
  sourceType: CandidateSourceType;
  title: string;
  sourceUrl?: string;
  supplierUrl?: string;
  storeUrl?: string;
  adLibraryUrl?: string;
  rawData?: Record<string, unknown>;
}

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Product {
  id: string;
  storeId: string | null;
  candidateId: string | null;
  shopifyProductGid: string | null;
  title: string;
  handle: string | null;
  status: ProductStatus;
  createdAt: Date;
}

export interface NewProduct {
  title: string;
  candidateId?: string;
  storeId?: string;
  status?: ProductStatus;
  content?: Record<string, unknown>;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

/** Дії, що вимагають ручного підтвердження (ТЗ §19). */
export type ApprovalAction =
  | 'CREATE_PRODUCT_FROM_CANDIDATE'
  | 'PUBLISH_PRODUCT'
  | 'PUSH_PRICE_CHANGE'
  | 'DISABLE_VARIANT'
  | 'CREATE_SUPPLIER_ORDER'
  | 'ACTIVATE_META_AD'
  | 'USE_HIGH_RISK_CLAIM'
  | 'SEND_REFUND_PROMISE'
  | 'USE_THIRD_PARTY_MEDIA';

export interface Approval {
  id: string;
  entityType: string;
  entityId: string;
  action: ApprovalAction;
  status: ApprovalStatus;
  requestedBy: string | null;
  decidedBy: string | null;
  comment: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export interface NewApproval {
  entityType: string;
  entityId: string;
  action: ApprovalAction;
  requestedBy?: string;
  payload?: Record<string, unknown>;
}

export type ActorType = 'USER' | 'SYSTEM';

export interface AuditEntry {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
}

export interface NewAuditEntry {
  actorType: ActorType;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

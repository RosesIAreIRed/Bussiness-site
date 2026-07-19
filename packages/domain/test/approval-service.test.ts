import { describe, expect, it } from 'vitest';
import {
  ApprovalAlreadyDecidedError,
  ApprovalForbiddenError,
  ApprovalNotFoundError,
  ApprovalService,
} from '../src/core/approval-service.js';
import { CandidateService } from '../src/core/candidate-service.js';
import type { Actor } from '../src/core/types.js';
import { createFakeState, createFakeUow, type FakeState } from './fakes.js';

const admin: Actor = { userId: 'admin-1', role: 'ADMIN' };
const viewer: Actor = { userId: 'viewer-1', role: 'VIEWER' };

async function setupPendingApproval(state: FakeState) {
  const uow = createFakeUow(state);
  const candidates = new CandidateService(uow);
  const candidate = await candidates.createManual(
    { sourceType: 'MANUAL', title: 'Портативний блендер' },
    admin,
  );
  const approval = await candidates.requestProductApproval(candidate.id, admin);
  return { candidate, approval, service: new ApprovalService(uow) };
}

describe('ApprovalService.decide', () => {
  it('APPROVED створює продукт із кандидата, оновлює kanban-статус, пише audit і події', async () => {
    const state = createFakeState();
    const { candidate, approval, service } = await setupPendingApproval(state);

    const result = await service.decide(approval.id, 'APPROVED', admin, 'беремо в тест');

    expect(result.approval.status).toBe('APPROVED');
    expect(result.createdProductId).toBeDefined();

    expect(state.products).toHaveLength(1);
    expect(state.products[0]).toMatchObject({
      title: 'Портативний блендер',
      candidateId: candidate.id,
      status: 'DRAFT',
    });

    const updatedCandidate = state.candidates[0]!;
    expect(updatedCandidate.status).toBe('TEST');
    expect(updatedCandidate.decision).toBe('TEST');

    const auditActions = state.audit.map((entry) => entry.action);
    expect(auditActions).toContain('approval.approved');
    expect(auditActions).toContain('product.created-from-candidate');

    const eventTypes = state.outbox.map((event) => event.type);
    expect(eventTypes).toContain('ApprovalDecided');
    expect(eventTypes).toContain('ProductCreatedFromCandidate');
  });

  it('REJECTED не створює продукт', async () => {
    const state = createFakeState();
    const { approval, service } = await setupPendingApproval(state);

    const result = await service.decide(approval.id, 'REJECTED', admin, 'слабка маржа');

    expect(result.approval.status).toBe('REJECTED');
    expect(result.createdProductId).toBeUndefined();
    expect(state.products).toHaveLength(0);
  });

  it('idempotent: повторне decide з тим самим результатом не дублює side effects', async () => {
    const state = createFakeState();
    const { approval, service } = await setupPendingApproval(state);

    await service.decide(approval.id, 'APPROVED', admin);
    const productsAfterFirst = state.products.length;
    const outboxAfterFirst = state.outbox.length;

    const repeat = await service.decide(approval.id, 'APPROVED', admin);

    expect(repeat.approval.status).toBe('APPROVED');
    expect(state.products.length).toBe(productsAfterFirst);
    expect(state.outbox.length).toBe(outboxAfterFirst);
  });

  it('конфліктне рішення по вирішеному approval — помилка', async () => {
    const state = createFakeState();
    const { approval, service } = await setupPendingApproval(state);

    await service.decide(approval.id, 'APPROVED', admin);

    await expect(service.decide(approval.id, 'REJECTED', admin)).rejects.toBeInstanceOf(
      ApprovalAlreadyDecidedError,
    );
  });

  it('VIEWER не може вирішувати approvals (RBAC)', async () => {
    const state = createFakeState();
    const { approval, service } = await setupPendingApproval(state);

    await expect(service.decide(approval.id, 'APPROVED', viewer)).rejects.toBeInstanceOf(
      ApprovalForbiddenError,
    );
  });

  it('неіснуючий approval — помилка', async () => {
    const state = createFakeState();
    const { service } = await setupPendingApproval(state);

    await expect(service.decide('missing', 'APPROVED', admin)).rejects.toBeInstanceOf(
      ApprovalNotFoundError,
    );
  });
});

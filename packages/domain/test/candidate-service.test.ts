import { describe, expect, it } from 'vitest';
import { CandidateNotFoundError, CandidateService } from '../src/core/candidate-service.js';
import type { Actor } from '../src/core/types.js';
import { createFakeState, createFakeUow } from './fakes.js';

const operator: Actor = { userId: 'user-1', role: 'OPERATOR' };

describe('CandidateService', () => {
  it('createManual створює кандидата з audit-записом і подією в outbox', async () => {
    const state = createFakeState();
    const service = new CandidateService(createFakeUow(state));

    const candidate = await service.createManual(
      { sourceType: 'MANUAL', title: 'Козирок від сонця', sourceUrl: 'https://example.com/p/1' },
      operator,
    );

    expect(candidate.status).toBe('INBOX');
    expect(state.candidates).toHaveLength(1);

    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]).toMatchObject({
      action: 'candidate.created',
      actorId: 'user-1',
      entityId: candidate.id,
    });

    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0]).toMatchObject({
      type: 'ProductCandidateImported',
      payload: { candidateId: candidate.id },
    });
  });

  it('requestProductApproval створює approval і є idempotent', async () => {
    const state = createFakeState();
    const service = new CandidateService(createFakeUow(state));
    const candidate = await service.createManual(
      { sourceType: 'MANUAL', title: 'Тестовий товар' },
      operator,
    );

    const first = await service.requestProductApproval(candidate.id, operator);
    const second = await service.requestProductApproval(candidate.id, operator);

    expect(first.action).toBe('CREATE_PRODUCT_FROM_CANDIDATE');
    expect(first.status).toBe('PENDING');
    expect(second.id).toBe(first.id);
    expect(state.approvals).toHaveLength(1);
    expect(state.outbox.filter((e) => e.type === 'ApprovalRequested')).toHaveLength(1);
  });

  it('requestProductApproval кидає помилку для неіснуючого кандидата', async () => {
    const service = new CandidateService(createFakeUow(createFakeState()));

    await expect(service.requestProductApproval('missing-id', operator)).rejects.toBeInstanceOf(
      CandidateNotFoundError,
    );
  });
});

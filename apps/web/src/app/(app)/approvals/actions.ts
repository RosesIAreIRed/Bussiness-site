'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decideApprovalInputSchema } from '@ormilo/contracts';
import { DomainError } from '@ormilo/domain';
import { requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';

export async function decideApprovalAction(formData: FormData): Promise<void> {
  const session = await requireSession();

  const parsed = decideApprovalInputSchema.safeParse({
    approvalId: formData.get('approvalId'),
    decision: formData.get('decision'),
    comment: formData.get('comment') || undefined,
  });
  if (!parsed.success) {
    redirect('/approvals?error=validation');
  }

  let errorCode: string | null = null;
  try {
    await getAppContext().approvalService.decide(
      parsed.data.approvalId,
      parsed.data.decision,
      { userId: session.userId, role: session.role },
      parsed.data.comment,
    );
  } catch (cause) {
    errorCode = cause instanceof DomainError ? cause.code : 'SERVER';
  }

  if (errorCode) {
    redirect(`/approvals?error=${encodeURIComponent(errorCode)}`);
  }

  revalidatePath('/approvals');
  revalidatePath('/research');
  revalidatePath('/products');
  revalidatePath('/dashboard');
  redirect('/approvals?decided=1');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createCandidateInputSchema } from '@ormilo/contracts';
import { requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';

export async function createCandidateAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role === 'VIEWER') {
    redirect('/research?error=forbidden');
  }

  const parsed = createCandidateInputSchema.safeParse({
    title: formData.get('title'),
    sourceUrl: formData.get('sourceUrl') ?? undefined,
    supplierUrl: formData.get('supplierUrl') ?? undefined,
  });
  if (!parsed.success) {
    redirect('/research?error=validation');
  }

  let failed = false;
  try {
    await getAppContext().candidateService.createManual(
      { sourceType: 'MANUAL', ...parsed.data },
      { userId: session.userId, role: session.role },
    );
  } catch {
    failed = true;
  }

  if (failed) {
    redirect('/research?error=server');
  }
  revalidatePath('/research');
  revalidatePath('/dashboard');
  redirect('/research');
}

export async function requestAnalysisAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role === 'VIEWER') {
    redirect('/research?error=forbidden');
  }

  const parsedId = z.uuid().safeParse(formData.get('candidateId'));
  if (!parsedId.success) {
    redirect('/research?error=validation');
  }

  let failed = false;
  try {
    await getAppContext().analysisService.requestAnalysis(parsedId.data, {
      userId: session.userId,
      role: session.role,
    });
  } catch {
    failed = true;
  }

  if (failed) {
    redirect('/research?error=server');
  }
  revalidatePath('/research');
  revalidatePath('/dashboard');
  redirect('/research?analyzing=1');
}

export async function requestProductApprovalAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role === 'VIEWER') {
    redirect('/research?error=forbidden');
  }

  const parsedId = z.uuid().safeParse(formData.get('candidateId'));
  if (!parsedId.success) {
    redirect('/research?error=validation');
  }

  let failed = false;
  try {
    await getAppContext().candidateService.requestProductApproval(parsedId.data, {
      userId: session.userId,
      role: session.role,
    });
  } catch {
    failed = true;
  }

  if (failed) {
    redirect('/research?error=server');
  }
  revalidatePath('/research');
  revalidatePath('/approvals');
  revalidatePath('/dashboard');
  redirect('/research?requested=1');
}

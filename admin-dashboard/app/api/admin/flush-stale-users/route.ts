import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { flushStaleUsersFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return NextResponse.redirect(new URL('/login', request.url), 303);
  const result = await flushStaleUsersFromForm(await request.formData());
  return NextResponse.redirect(
    new URL(`/controls?staleUserDays=${result.days}&notice=stale-users-deleted`, request.url),
    303
  );
}

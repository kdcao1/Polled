import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { flushStaleEventsFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return NextResponse.redirect(new URL('/login', request.url), 303);
  const result = await flushStaleEventsFromForm(await request.formData());
  return NextResponse.redirect(
    new URL(`/controls?staleDays=${result.days}&notice=stale-events-deleted`, request.url),
    303
  );
}

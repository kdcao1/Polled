import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { deleteEventFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return NextResponse.redirect(new URL('/login', request.url), 303);
  await deleteEventFromForm(await request.formData());
  return NextResponse.redirect(new URL('/controls?notice=event-deleted', request.url), 303);
}

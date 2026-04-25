import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { updateUserFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return NextResponse.redirect(new URL('/login', request.url), 303);
  await updateUserFromForm(await request.formData());
  return NextResponse.redirect(new URL('/controls?notice=user-updated', request.url), 303);
}

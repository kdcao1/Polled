import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { deleteUserFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return NextResponse.redirect(new URL('/login', request.url), 303);
  await deleteUserFromForm(await request.formData());
  return NextResponse.redirect(new URL('/controls?notice=user-deleted', request.url), 303);
}

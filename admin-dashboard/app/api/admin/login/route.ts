import { NextResponse } from 'next/server';
import { setAdminSession, validateAdminSecret } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get('password');

  if (typeof password !== 'string' || !validateAdminSecret(password)) {
    return NextResponse.redirect(new URL('/login?error=1', request.url), 303);
  }

  setAdminSession();
  return NextResponse.redirect(new URL('/', request.url), 303);
}

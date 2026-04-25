import { NextResponse } from 'next/server';
import { clearAdminSession } from '@/lib/admin-auth';

export async function POST(request: Request) {
  clearAdminSession();
  return NextResponse.redirect(new URL('/login', request.url), 303);
}

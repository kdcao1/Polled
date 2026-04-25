import { NextResponse } from 'next/server';

export function adminRedirect(request: Request, path: string) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host') || new URL(request.url).host;
  const proto = forwardedProto || (host.includes('localhost') ? 'http' : 'https');

  return NextResponse.redirect(new URL(path, `${proto}://${host}`), 303);
}

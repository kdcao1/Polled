import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'polled_admin_session';

function configuredSecret() {
  return process.env.ADMIN_SECRET?.trim() ?? '';
}

function sessionToken(secret: string) {
  return createHash('sha256').update(`polled-admin:${secret}`).digest('hex');
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function isAdminLoginEnabled() {
  return Boolean(configuredSecret());
}

export function isAdminAuthenticated() {
  const secret = configuredSecret();
  if (!secret) return true;

  const cookieValue = cookies().get(COOKIE_NAME)?.value ?? '';
  return Boolean(cookieValue) && safeEqual(cookieValue, sessionToken(secret));
}

export function requireAdminSession() {
  if (!isAdminAuthenticated()) redirect('/login');
}

export function requireAdminSessionForAction() {
  if (!isAdminAuthenticated()) {
    throw new Error('Admin login required.');
  }
}

export function setAdminSession() {
  const secret = configuredSecret();
  if (!secret) return;

  cookies().set(COOKIE_NAME, sessionToken(secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export function clearAdminSession() {
  cookies().delete(COOKIE_NAME);
}

export function validateAdminSecret(candidate: string) {
  const secret = configuredSecret();
  return Boolean(secret) && safeEqual(candidate, secret);
}

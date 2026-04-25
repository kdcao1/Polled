import { setAdminSession, validateAdminSecret } from '@/lib/admin-auth';
import { adminRedirect } from '@/lib/admin-redirect';

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get('password');

  if (typeof password !== 'string' || !validateAdminSecret(password)) {
    return adminRedirect(request, '/login?error=1');
  }

  setAdminSession();
  return adminRedirect(request, '/');
}

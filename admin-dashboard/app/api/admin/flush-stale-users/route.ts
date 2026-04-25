import { isAdminAuthenticated } from '@/lib/admin-auth';
import { adminRedirect } from '@/lib/admin-redirect';
import { flushStaleUsersFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return adminRedirect(request, '/login');
  const result = await flushStaleUsersFromForm(await request.formData());
  return adminRedirect(request, `/controls?staleUserDays=${result.days}&notice=stale-users-deleted`);
}

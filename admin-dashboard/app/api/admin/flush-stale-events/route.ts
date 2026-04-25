import { isAdminAuthenticated } from '@/lib/admin-auth';
import { adminRedirect } from '@/lib/admin-redirect';
import { flushStaleEventsFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return adminRedirect(request, '/login');
  const result = await flushStaleEventsFromForm(await request.formData());
  return adminRedirect(request, `/controls?staleDays=${result.days}&notice=stale-events-deleted`);
}

import { isAdminAuthenticated } from '@/lib/admin-auth';
import { adminRedirect } from '@/lib/admin-redirect';
import { deleteEventFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return adminRedirect(request, '/login');
  await deleteEventFromForm(await request.formData());
  return adminRedirect(request, '/controls?notice=event-deleted');
}

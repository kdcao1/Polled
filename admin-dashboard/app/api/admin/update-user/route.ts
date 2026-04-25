import { isAdminAuthenticated } from '@/lib/admin-auth';
import { adminRedirect } from '@/lib/admin-redirect';
import { updateUserFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return adminRedirect(request, '/login');
  await updateUserFromForm(await request.formData());
  return adminRedirect(request, '/controls?notice=user-updated');
}

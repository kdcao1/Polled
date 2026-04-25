import { isAdminAuthenticated } from '@/lib/admin-auth';
import { adminRedirect } from '@/lib/admin-redirect';
import { deleteUserFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return adminRedirect(request, '/login');
  await deleteUserFromForm(await request.formData());
  return adminRedirect(request, '/controls?notice=user-deleted');
}

import { isAdminAuthenticated } from '@/lib/admin-auth';
import { adminRedirect } from '@/lib/admin-redirect';
import { setMaintenanceFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return adminRedirect(request, '/login');
  const enabled = await setMaintenanceFromForm(await request.formData());
  return adminRedirect(request, `/controls?notice=${enabled ? 'maintenance-on' : 'maintenance-off'}`);
}

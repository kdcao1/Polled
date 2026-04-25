import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { setMaintenanceFromForm } from '@/lib/admin-operations';

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return NextResponse.redirect(new URL('/login', request.url), 303);
  const enabled = await setMaintenanceFromForm(await request.formData());
  return NextResponse.redirect(new URL(`/controls?notice=${enabled ? 'maintenance-on' : 'maintenance-off'}`, request.url), 303);
}

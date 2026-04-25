import AdminControls from '@/components/AdminControls';
import AdminShell from '@/components/AdminShell';
import { requireAdminSession } from '@/lib/admin-auth';
import {
  canUseFirebaseAdmin,
  fetchAdminEvents,
  fetchAdminUsers,
  fetchMaintenanceState,
  fetchStaleEventCandidates,
  fetchStaleUserCandidates,
} from '@/lib/admin-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const allowedStaleDays = new Set([15, 30, 45, 90, 365]);
const allowedStaleUserDays = new Set([30, 60, 90, 180, 365]);
const pageSize = 20;

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default async function ControlsPage({
  searchParams,
}: {
  searchParams?: {
    eventPage?: string;
    notice?: string;
    staleDays?: string;
    stalePage?: string;
    staleUserDays?: string;
    staleUserPage?: string;
    userPage?: string;
  };
}) {
  requireAdminSession();

  const requestedStaleDays = Number.parseInt(searchParams?.staleDays ?? '', 10);
  const requestedStaleUserDays = Number.parseInt(searchParams?.staleUserDays ?? '', 10);
  const staleDays = allowedStaleDays.has(requestedStaleDays) ? requestedStaleDays : 30;
  const staleUserDays = allowedStaleUserDays.has(requestedStaleUserDays) ? requestedStaleUserDays : 90;
  const eventPage = parsePage(searchParams?.eventPage);
  const userPage = parsePage(searchParams?.userPage);
  const stalePage = parsePage(searchParams?.stalePage);
  const staleUserPage = parsePage(searchParams?.staleUserPage);
  const [adminEvents, adminUsers, maintenanceState, staleEvents, staleUsers] = await Promise.all([
    fetchAdminEvents(eventPage, pageSize),
    fetchAdminUsers(userPage, pageSize),
    fetchMaintenanceState(),
    fetchStaleEventCandidates(staleDays, stalePage, pageSize),
    fetchStaleUserCandidates(staleUserDays, staleUserPage, pageSize),
  ]);

  return (
    <AdminShell active="controls">
      <AdminControls
        canManageFirebase={canUseFirebaseAdmin()}
        events={adminEvents}
        users={adminUsers}
        maintenance={maintenanceState}
        staleEvents={staleEvents}
        staleUsers={staleUsers}
        staleDays={staleDays}
        staleUserDays={staleUserDays}
        eventPage={eventPage}
        userPage={userPage}
        stalePage={stalePage}
        staleUserPage={staleUserPage}
        notice={searchParams?.notice}
      />
    </AdminShell>
  );
}

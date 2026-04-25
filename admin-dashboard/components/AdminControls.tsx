import AdminTable from '@/components/AdminTable';
import type {
  AdminEvent,
  AdminUser,
  MaintenanceState,
  PaginatedResult,
  StaleEventCandidate,
  StaleUserCandidate,
} from '@/lib/admin-data';

type Props = {
  canManageFirebase: boolean;
  events: PaginatedResult<AdminEvent>;
  users: PaginatedResult<AdminUser>;
  maintenance: MaintenanceState;
  staleEvents: PaginatedResult<StaleEventCandidate>;
  staleUsers: PaginatedResult<StaleUserCandidate>;
  staleDays: number;
  staleUserDays: number;
  eventPage: number;
  userPage: number;
  stalePage: number;
  staleUserPage: number;
  notice?: string;
};

function formatDate(value: string) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function controlsHref(params: {
  eventPage: number;
  staleDays: number;
  stalePage: number;
  staleUserDays: number;
  staleUserPage: number;
  userPage: number;
}) {
  const query = new URLSearchParams();
  query.set('eventPage', String(params.eventPage));
  query.set('staleDays', String(params.staleDays));
  query.set('userPage', String(params.userPage));
  query.set('stalePage', String(params.stalePage));
  query.set('staleUserDays', String(params.staleUserDays));
  query.set('staleUserPage', String(params.staleUserPage));
  return `/controls?${query.toString()}`;
}

function PaginationControls({
  label,
  page,
  hasPrevious,
  hasNext,
  previousHref,
  nextHref,
}: {
  label: string;
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  previousHref: string;
  nextHref: string;
}) {
  const baseClass = 'rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold';
  const disabledClass = `${baseClass} cursor-not-allowed text-gray-300`;
  const enabledClass = `${baseClass} text-gray-600 hover:border-gray-900 hover:text-gray-900`;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
      <p className="text-xs text-gray-400">
        {label} page {page}
      </p>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <a className={enabledClass} href={previousHref}>
            Previous
          </a>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        {hasNext ? (
          <a className={enabledClass} href={nextHref}>
            Next
          </a>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>
    </div>
  );
}

export default function AdminControls({
  canManageFirebase,
  events,
  users,
  maintenance,
  staleEvents,
  staleUsers,
  staleDays,
  staleUserDays,
  eventPage,
  userPage,
  stalePage,
  staleUserPage,
  notice,
}: Props) {
  const noticeText =
    notice === 'maintenance-on'
      ? 'Maintenance mode activated. The app will show the maintenance screen.'
      : notice === 'maintenance-off'
        ? 'Maintenance mode turned off. The app is available again.'
        : notice === 'user-updated'
          ? 'User updated.'
          : notice === 'user-deleted'
            ? 'User deleted.'
            : notice === 'stale-events-deleted'
              ? 'Stale events deleted.'
              : notice === 'event-deleted'
                ? 'Event deleted.'
                : notice === 'stale-users-deleted'
                  ? 'Stale users deleted.'
                  : '';

  return (
    <section className="mt-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Admin Controls</h2>
        <p className="text-sm text-gray-500">
          User management, maintenance mode, and stale event cleanup use Firebase Admin.
        </p>
      </div>

      {!canManageFirebase && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Add <code>GOOGLE_SERVICE_ACCOUNT_KEY</code> or <code>GOOGLE_APPLICATION_CREDENTIALS</code> to <code>admin-dashboard/.env</code> to enable these controls.
          Local SQLite analytics can still load without it.
        </div>
      )}

      {noticeText && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {noticeText}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Maintenance Mode</h3>
          <p className="text-xs text-gray-400 mb-4">
            Blocks the app with a maintenance message until this is turned off.
          </p>
          <form action="/api/admin/maintenance" method="post" className="space-y-4">
            <input type="hidden" name="enabled" value={maintenance.enabled ? 'off' : 'on'} />
            <input type="hidden" name="message" value={maintenance.message} />
            <button
              type="submit"
              disabled={!canManageFirebase}
              className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
              aria-pressed={maintenance.enabled}
            >
              <span>
                <span className="block text-sm font-semibold text-gray-800">
                  {maintenance.enabled ? 'Maintenance is on' : 'Maintenance is off'}
                </span>
                <span className="mt-1 block text-xs text-gray-400">
                  Click to {maintenance.enabled ? 'turn it off' : 'turn it on'}.
                </span>
              </span>
              <span
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  maintenance.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    maintenance.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </button>
            <div className="rounded-md border border-gray-100 bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Message</p>
              <p className="mt-1 text-sm text-gray-600">
                {maintenance.message || 'Polled is temporarily down for maintenance.'}
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Last updated: {formatDate(maintenance.updatedAt)}
            </p>
          </form>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Flush Stale Events</h3>
          <p className="text-xs text-gray-400 mb-4">
            Deletes events with no detected activity for the selected window.
          </p>
          <form className="mb-4 flex items-center gap-2" action="/controls">
            <input type="hidden" name="eventPage" value={eventPage} />
            <input type="hidden" name="userPage" value={userPage} />
            <input type="hidden" name="stalePage" value="1" />
            <input type="hidden" name="staleUserDays" value={staleUserDays} />
            <input type="hidden" name="staleUserPage" value={staleUserPage} />
            <label className="text-xs font-semibold text-gray-500" htmlFor="staleDays">
              Inactive for
            </label>
            <select
              id="staleDays"
              name="staleDays"
              defaultValue={staleDays}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-gray-900"
            >
              {[15, 30, 45, 90, 365].map((days) => (
                <option key={days} value={days}>
                  {days === 365 ? '1 year' : `${days} days`}
                </option>
              ))}
            </select>
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600">
              Preview
            </button>
          </form>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100">
            {staleEvents.items.length === 0 ? (
              <p className="p-3 text-sm text-gray-400">No stale event candidates found.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-400 uppercase">
                  <tr>
                    <th className="p-2 text-left">Event</th>
                    <th className="p-2 text-right">Inactive</th>
                  </tr>
                </thead>
                <tbody>
                  {staleEvents.items.map((event) => (
                    <tr key={event.id} className="border-t border-gray-50">
                      <td className="p-2">
                        <div className="font-medium text-gray-700">{event.title}</div>
                        <div className="text-gray-400">{event.id}</div>
                      </td>
                      <td className="p-2 text-right text-gray-600">{event.ageDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <PaginationControls
            label={`${staleEvents.total ?? staleEvents.items.length} stale events`}
            page={staleEvents.page}
            hasPrevious={staleEvents.hasPrevious}
            hasNext={staleEvents.hasNext}
            previousHref={controlsHref({
              eventPage,
              staleDays,
              stalePage: stalePage - 1,
              staleUserDays,
              staleUserPage,
              userPage,
            })}
            nextHref={controlsHref({
              eventPage,
              staleDays,
              stalePage: stalePage + 1,
              staleUserDays,
              staleUserPage,
              userPage,
            })}
          />
          <form action="/api/admin/flush-stale-events" method="post" className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="days" value={staleDays} />
            <input
              name="confirm"
              disabled={!canManageFirebase || staleEvents.items.length === 0}
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 disabled:bg-gray-50"
              placeholder="Type DELETE"
            />
            <button
              type="submit"
              disabled={!canManageFirebase || staleEvents.items.length === 0}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete Stale
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Flush Stale Users</h3>
          <p className="text-xs text-gray-400 mb-4">
            Deletes Auth users with no sign-in activity in the selected window.
          </p>
          <form className="mb-4 flex items-center gap-2" action="/controls">
            <input type="hidden" name="eventPage" value={eventPage} />
            <input type="hidden" name="userPage" value={userPage} />
            <input type="hidden" name="staleDays" value={staleDays} />
            <input type="hidden" name="stalePage" value={stalePage} />
            <input type="hidden" name="staleUserPage" value="1" />
            <label className="text-xs font-semibold text-gray-500" htmlFor="staleUserDays">
              Inactive for
            </label>
            <select
              id="staleUserDays"
              name="staleUserDays"
              defaultValue={staleUserDays}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-gray-900"
            >
              {[30, 60, 90, 180, 365].map((days) => (
                <option key={days} value={days}>
                  {days === 365 ? '1 year' : `${days} days`}
                </option>
              ))}
            </select>
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600">
              Preview
            </button>
          </form>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100">
            {staleUsers.items.length === 0 ? (
              <p className="p-3 text-sm text-gray-400">No stale user candidates found.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-400 uppercase">
                  <tr>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-right">Inactive</th>
                  </tr>
                </thead>
                <tbody>
                  {staleUsers.items.map((user) => (
                    <tr key={user.uid} className="border-t border-gray-50">
                      <td className="p-2">
                        <div className="font-medium text-gray-700">{user.displayName || user.email || 'Unnamed'}</div>
                        <div className="text-gray-400">{user.email || user.uid}</div>
                      </td>
                      <td className="p-2 text-right text-gray-600">{user.ageDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <PaginationControls
            label={`${staleUsers.total ?? staleUsers.items.length} stale users`}
            page={staleUsers.page}
            hasPrevious={staleUsers.hasPrevious}
            hasNext={staleUsers.hasNext}
            previousHref={controlsHref({
              eventPage,
              staleDays,
              stalePage,
              staleUserDays,
              staleUserPage: staleUserPage - 1,
              userPage,
            })}
            nextHref={controlsHref({
              eventPage,
              staleDays,
              stalePage,
              staleUserDays,
              staleUserPage: staleUserPage + 1,
              userPage,
            })}
          />
          <form action="/api/admin/flush-stale-users" method="post" className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="days" value={staleUserDays} />
            <input
              name="confirm"
              disabled={!canManageFirebase || staleUsers.items.length === 0}
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 disabled:bg-gray-50"
              placeholder="Type DELETE"
            />
            <button
              type="submit"
              disabled={!canManageFirebase || staleUsers.items.length === 0}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete Stale
            </button>
          </form>
        </div>
      </div>

      <AdminTable
        title="Events"
        description="Delete a specific event and its polls, members, join-code reservation, and member dashboard references."
        headers={['Event', 'Status', 'Join code', 'Updated', 'Delete']}
        footer={
          <PaginationControls
            label="Events"
            page={events.page}
            hasPrevious={events.hasPrevious}
            hasNext={events.hasNext}
            previousHref={controlsHref({
              eventPage: eventPage - 1,
              staleDays,
              stalePage,
              staleUserDays,
              staleUserPage,
              userPage,
            })}
            nextHref={controlsHref({
              eventPage: eventPage + 1,
              staleDays,
              stalePage,
              staleUserDays,
              staleUserPage,
              userPage,
            })}
          />
        }
      >
        {events.items.length === 0 ? (
          <tr>
            <td colSpan={5} className="py-4 text-gray-400">
              No events loaded.
            </td>
          </tr>
        ) : (
          events.items.map((event) => (
            <tr key={event.id} className="border-b border-gray-50 last:border-0">
              <td className="py-3 pr-3">
                <div className="font-medium text-gray-700">{event.title}</div>
                <div className="text-gray-400">{event.id}</div>
              </td>
              <td className="py-3 pr-3 text-gray-600">{event.status || 'unknown'}</td>
              <td className="py-3 pr-3 text-gray-600">{event.joinCode || '-'}</td>
              <td className="py-3 pr-3 text-gray-600">{formatDate(event.updatedAt || event.createdAt)}</td>
              <td className="py-3 text-right">
                <form action="/api/admin/delete-event" method="post">
                  <input type="hidden" name="eventId" value={event.id} />
                  <button
                    type="submit"
                    disabled={!canManageFirebase}
                    className="rounded-md border border-red-200 px-3 py-1.5 font-semibold text-red-600 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))
        )}
      </AdminTable>

      <AdminTable
        title="Users"
        description="Modify display names, disable accounts, or delete users."
        headers={['User', 'Provider', 'Last sign in', 'Modify', 'Delete']}
        footer={
          <PaginationControls
            label="Users"
            page={users.page}
            hasPrevious={users.hasPrevious}
            hasNext={users.hasNext}
            previousHref={controlsHref({
              eventPage,
              staleDays,
              stalePage,
              staleUserDays,
              staleUserPage,
              userPage: userPage - 1,
            })}
            nextHref={controlsHref({
              eventPage,
              staleDays,
              stalePage,
              staleUserDays,
              staleUserPage,
              userPage: userPage + 1,
            })}
          />
        }
      >
        {users.items.length === 0 ? (
          <tr>
            <td colSpan={5} className="py-4 text-gray-400">
              No users loaded.
            </td>
          </tr>
        ) : (
          users.items.map((user) => (
            <tr key={user.uid} className="border-b border-gray-50 last:border-0">
              <td className="py-3 pr-3">
                <div className="font-medium text-gray-700">{user.displayName || 'Unnamed'}</div>
                <div className="text-gray-400">{user.email || user.uid}</div>
              </td>
              <td className="py-3 pr-3 text-gray-600">{user.provider}</td>
              <td className="py-3 pr-3 text-gray-600">{formatDate(user.lastSignInAt)}</td>
              <td className="py-3 pr-3">
                <form action="/api/admin/update-user" method="post" className="flex items-center gap-2">
                  <input type="hidden" name="uid" value={user.uid} />
                  <input
                    name="displayName"
                    defaultValue={user.displayName}
                    disabled={!canManageFirebase}
                    className="w-40 rounded-md border border-gray-200 px-2 py-1.5 outline-none focus:border-brand disabled:bg-gray-50"
                    placeholder="Display name"
                  />
                  <label className="flex items-center gap-1 text-gray-500">
                    <input
                      type="checkbox"
                      name="disabled"
                      defaultChecked={user.disabled}
                      disabled={!canManageFirebase}
                    />
                    Disabled
                  </label>
                  <button
                    type="submit"
                    disabled={!canManageFirebase}
                    className="rounded-md bg-gray-900 px-3 py-1.5 font-semibold text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                </form>
              </td>
              <td className="py-3 text-right">
                <form action="/api/admin/delete-user" method="post">
                  <input type="hidden" name="uid" value={user.uid} />
                  <button
                    type="submit"
                    disabled={!canManageFirebase}
                    className="rounded-md border border-red-200 px-3 py-1.5 font-semibold text-red-600 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))
        )}
      </AdminTable>
    </section>
  );
}

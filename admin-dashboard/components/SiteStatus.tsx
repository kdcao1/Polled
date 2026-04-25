import type { AnalyticsIngestStatus } from '@/lib/analytics';

type Props = {
  maintenance: {
    enabled: boolean;
    message: string;
    updatedAt: string | null;
  };
  analytics: AnalyticsIngestStatus;
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

export default function SiteStatus({ maintenance, analytics }: Props) {
  const items = [
    {
      label: 'App Status',
      value: maintenance.enabled ? 'Maintenance On' : 'Live',
      sub: maintenance.enabled ? maintenance.message : 'Users can access Polled.',
      tone: maintenance.enabled ? 'amber' : 'emerald',
    },
    {
      label: 'Analytics Ingest',
      value: analytics.sqliteEnabled ? 'Connected' : 'No SQLite File',
      sub: `${analytics.eventsLast24h.toLocaleString()} events from ${analytics.usersLast24h.toLocaleString()} users in 24h`,
      tone: analytics.sqliteEnabled ? 'emerald' : 'red',
    },
    {
      label: 'Last Analytics Event',
      value: formatDate(analytics.lastEventAt),
      sub: `${analytics.totalEvents.toLocaleString()} total local events`,
      tone: analytics.lastEventAt ? 'slate' : 'amber',
    },
  ];

  const toneClass = {
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
          <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${toneClass[item.tone as keyof typeof toneClass]}`}>
            {item.value}
          </div>
          <p className="mt-3 text-sm text-gray-500">{item.sub}</p>
          {item.label === 'App Status' && maintenance.updatedAt && (
            <p className="mt-1 text-xs text-gray-400">Updated {formatDate(maintenance.updatedAt)}</p>
          )}
        </div>
      ))}
    </section>
  );
}

import type { RecentAnalyticsEvent } from '@/lib/analytics';

type Props = {
  data: RecentAnalyticsEvent[];
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

export default function RecentAnalyticsEventsTable({ data }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Recent Raw Events</h2>
        <span className="text-xs font-medium text-gray-400">Latest {data.length.toLocaleString()}</span>
      </div>
      <div className="max-h-[520px] overflow-auto pr-1">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-semibold">Event</th>
              <th className="pb-2 font-semibold">User</th>
              <th className="pb-2 font-semibold">Platform</th>
              <th className="pb-2 font-semibold">Params</th>
              <th className="pb-2 text-right font-semibold">Ingested</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={`${row.name}-${row.ingestedAt}-${index}`} className="border-b border-gray-50 last:border-0 align-top">
                <td className="py-3">
                  <div className="font-medium text-gray-700">{row.label}</div>
                  <div className="font-mono text-xs text-gray-400">{row.kind}</div>
                </td>
                <td className="py-3 font-mono text-xs text-gray-500">{row.uid}</td>
                <td className="py-3 text-gray-500">{row.platform}</td>
                <td className="max-w-[360px] py-3">
                  <code className="block truncate rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">
                    {row.params}
                  </code>
                </td>
                <td className="py-3 text-right text-xs text-gray-500">{formatDate(row.ingestedAt)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="py-6 text-center text-gray-400" colSpan={5}>No raw analytics events yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

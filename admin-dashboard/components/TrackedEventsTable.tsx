import type { TrackedEventInventoryPoint } from '@/lib/analytics';

type Props = {
  data: TrackedEventInventoryPoint[];
};

function formatDate(value: string | null) {
  if (!value) return 'Not seen yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

export default function TrackedEventsTable({ data }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Everything Tracked</h2>
        <span className="text-xs font-medium text-gray-400">{data.length.toLocaleString()} event names</span>
      </div>
      <div className="max-h-[520px] overflow-auto pr-1">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-semibold">Event</th>
              <th className="pb-2 font-semibold">Category</th>
              <th className="pb-2 text-right font-semibold">Seen</th>
              <th className="pb-2 text-right font-semibold">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name} className="border-b border-gray-50 last:border-0">
                <td className="py-3">
                  <div className="font-medium text-gray-700">{row.label}</div>
                  <div className="font-mono text-xs text-gray-400">{row.name}</div>
                </td>
                <td className="py-3 text-gray-500">{row.category}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{row.observedCount.toLocaleString()}</td>
                <td className="py-3 text-right text-xs text-gray-500">{formatDate(row.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

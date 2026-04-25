import type { ActionAnalyticsPoint } from '@/lib/analytics';

type Props = {
  data: ActionAnalyticsPoint[];
};

export default function ActionAnalyticsTable({ data }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Top User Actions (28d)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-semibold">Action</th>
              <th className="pb-2 text-right font-semibold">Events</th>
              <th className="pb-2 text-right font-semibold">Users</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.action} className="border-b border-gray-50 last:border-0">
                <td className="py-3 font-medium text-gray-700">{row.action}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{row.count.toLocaleString()}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{row.users.toLocaleString()}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="py-6 text-center text-gray-400" colSpan={3}>No action analytics yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

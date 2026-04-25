import type { TimeAnalyticsPoint } from '@/lib/analytics';

type Props = {
  data: TimeAnalyticsPoint[];
};

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

export default function TimeAnalyticsTable({ data }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Time Analytics (28d)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-semibold">Metric</th>
              <th className="pb-2 text-right font-semibold">Avg</th>
              <th className="pb-2 text-right font-semibold">Median</th>
              <th className="pb-2 text-right font-semibold">Samples</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.metric} className="border-b border-gray-50 last:border-0">
                <td className="py-3 font-medium text-gray-700">{row.metric}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{formatSeconds(row.averageSeconds)}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{formatSeconds(row.medianSeconds)}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{row.samples.toLocaleString()}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="py-6 text-center text-gray-400" colSpan={4}>No duration events yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

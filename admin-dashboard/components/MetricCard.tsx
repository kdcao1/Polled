interface Props {
  label: string;
  value: string | number;
  sub?: string;
}

export default function MetricCard({ label, value, sub }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

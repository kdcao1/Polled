interface Props {
  data: { event: string; count: number }[];
}

export default function TopEventsTable({ data }: Props) {
  const max = data[0]?.count ?? 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Events by Poll Count</h2>
      <div className="flex flex-col gap-3">
        {data.map(({ event, count }) => (
          <div key={event}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-700 font-medium truncate max-w-[70%]">{event}</span>
              <span className="text-gray-500">{count.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-brand"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  data: { screen: string; views: number; users: number }[];
}

export default function TopScreensTable({ data }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Events by Members</h2>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 uppercase text-[10px] tracking-wide border-b border-gray-100">
            <th className="text-left pb-2">Event</th>
            <th className="text-right pb-2">Members</th>
            <th className="text-right pb-2">Polls</th>
          </tr>
        </thead>
        <tbody>
          {data.map(({ screen, views, users }) => (
            <tr key={screen} className="border-b border-gray-50 last:border-0">
              <td className="py-2 text-gray-700 font-medium truncate max-w-[160px]">{screen}</td>
              <td className="py-2 text-right text-gray-600">{views.toLocaleString()}</td>
              <td className="py-2 text-right text-gray-600">{users.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

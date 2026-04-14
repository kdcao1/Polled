'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  labels: string[];
  thisWeek: number[];
  lastWeek: number[];
}

export default function DAUComparisonChart({ labels, thisWeek, lastWeek }: Props) {
  const data = labels.map((label, i) => ({
    label,
    'This week': thisWeek[i],
    'Last week': lastWeek[i],
  }));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Daily Active Users</h2>
      <p className="text-xs text-gray-400 mb-4">This week vs last week</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="This week"
            stroke="#6C63FF"
            strokeWidth={2}
            dot={{ r: 3, fill: '#6C63FF' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="Last week"
            stroke="#6C63FF"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3, fill: '#6C63FF' }}
            activeDot={{ r: 5 }}
            opacity={0.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

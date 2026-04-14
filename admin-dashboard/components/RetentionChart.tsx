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

interface RetentionPoint {
  label: string;
  rate: number;
}

interface Props {
  thisWeek: RetentionPoint[];
  lastWeek: RetentionPoint[];
}

function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  const date = new Date(Number(iso.split('-')[0]), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RetentionChart({ thisWeek, lastWeek }: Props) {
  const data = thisWeek.map((tw, i) => ({
    label: shortDate(tw.label),
    'This week': tw.rate,
    'Last week': lastWeek[i]?.rate ?? 0,
  }));

  const avgThisWeek =
    thisWeek.length > 0
      ? Math.round(thisWeek.reduce((s, p) => s + p.rate, 0) / thisWeek.length)
      : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-700">Day 1 Retention</h2>
        <span className="text-xl font-bold text-gray-900">{avgThisWeek}%</span>
      </div>
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
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(v: number) => `${v}%`}
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

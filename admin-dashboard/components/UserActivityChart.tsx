'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';

interface DataPoint {
  date: string;
  oneDay: number;
  sevenDay: number;
  twentyEightDay: number;
}

interface Props {
  data: DataPoint[];
}

function formatDate(raw: string) {
  // raw = "YYYYMMDD"
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  // Show "15\nMar" style — just return day number, month shown separately
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// Custom dot: only renders on the last data point, with different shapes per series
function EndDot({ cx, cy, index, dataLength, color, shape }: {
  cx?: number; cy?: number; index?: number; dataLength: number; color: string; shape: 'circle' | 'square' | 'diamond';
}) {
  if (index !== dataLength - 1 || cx === undefined || cy === undefined) return null;
  const s = 6;
  if (shape === 'circle') {
    return <circle cx={cx} cy={cy} r={s} fill={color} stroke="#1e2433" strokeWidth={2} />;
  }
  if (shape === 'square') {
    return <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill={color} stroke="#1e2433" strokeWidth={2} />;
  }
  // diamond
  return (
    <polygon
      points={`${cx},${cy - s * 1.3} ${cx + s},${cy} ${cx},${cy + s * 1.3} ${cx - s},${cy}`}
      fill={color}
      stroke="#1e2433"
      strokeWidth={2}
    />
  );
}

export default function UserActivityChart({ data }: Props) {
  const formatted = data.map((row) => ({
    date: formatDate(row.date),
    '1 Day': row.oneDay,
    '7 Days': row.sevenDay,
    '28 Days': row.twentyEightDay,
  }));

  const latest = data[data.length - 1];
  const n = formatted.length;

  const series = [
    { key: '28 Days', color: '#4A90D9', shape: 'circle'  as const, value: latest?.twentyEightDay ?? 0 },
    { key: '7 Days',  color: '#57A55A', shape: 'square'  as const, value: latest?.sevenDay ?? 0 },
    { key: '1 Day',   color: '#E8A838', shape: 'diamond' as const, value: latest?.oneDay ?? 0 },
  ];

  return (
    <div className="rounded-2xl p-5 flex gap-6" style={{ background: '#1e2433' }}>
      {/* Chart */}
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 border-b border-dashed border-gray-600 pb-1 inline-block">
          User activity over time
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={formatted} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="" stroke="#2d3448" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(n / 5)}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              orientation="right"
            />
            <Tooltip
              contentStyle={{
                background: '#2d3448',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                color: '#e5e7eb',
              }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            {series.map(({ key, color, shape }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={(props: any) => (
                  <EndDot
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    index={props.index}
                    dataLength={n}
                    color={color}
                    shape={shape}
                  />
                )}
                activeDot={{ r: 4, fill: color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Right legend with current values */}
      <div className="flex flex-col justify-center gap-6 pr-2 min-w-[90px]">
        {series.map(({ key, color, value, shape }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              {shape === 'circle'  && <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />}
              {shape === 'square'  && <span style={{ width: 10, height: 10, background: color, display: 'inline-block' }} />}
              {shape === 'diamond' && (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <polygon points="6,0 12,6 6,12 0,6" fill={color} />
                </svg>
              )}
              <span className="text-xs font-semibold tracking-widest" style={{ color }}>{key.toUpperCase()}</span>
            </div>
            <p className="text-3xl font-bold text-white leading-none">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { ANALYTICS_RANGES, type AnalyticsRangeKey } from '@/lib/analytics';

type Props = {
  activeRange: AnalyticsRangeKey;
};

export default function AnalyticsRangeTabs({ activeRange }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Range</span>
      <div className="flex flex-wrap gap-2">
        {ANALYTICS_RANGES.map((range) => {
          const active = range.key === activeRange;
          return (
            <Link
              key={range.key}
              href={`/?range=${range.key}`}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              {range.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

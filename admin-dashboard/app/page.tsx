import {
  fetchOverview,
  fetchDailyUsers,
  fetchTopEvents,
  fetchTopScreens,
  fetchUserType,
  fetchPlatforms,
  fetchDAUComparison,
  fetchDay1Retention,
  fetchUserActivityOverTime,
} from '@/lib/analytics';
import MetricCard from '@/components/MetricCard';
import DailyUsersChart from '@/components/DailyUsersChart';
import DAUComparisonChart from '@/components/DAUComparisonChart';
import RetentionChart from '@/components/RetentionChart';
import UserActivityChart from '@/components/UserActivityChart';
import TopEventsTable from '@/components/TopEventsTable';
import TopScreensTable from '@/components/TopScreensTable';
import PieBreakdown from '@/components/PieBreakdown';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  let overview, dailyUsers, topEvents, topScreens, userType, platforms,
      dauComparison, day1Retention, userActivity;

  try {
    overview      = await fetchOverview();
    dailyUsers    = await fetchDailyUsers();
    topEvents     = await fetchTopEvents();
    topScreens    = await fetchTopScreens();
    userType      = await fetchUserType();
    platforms     = await fetchPlatforms();
    dauComparison = await fetchDAUComparison();
    day1Retention = await fetchDay1Retention();
    userActivity  = await fetchUserActivityOverTime();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-lg w-full">
          <h1 className="text-lg font-semibold text-red-700 mb-2">Failed to load analytics</h1>
          <p className="text-sm text-red-600 font-mono">{message}</p>
          <p className="text-xs text-red-400 mt-4">
            Make sure <code>GOOGLE_SERVICE_ACCOUNT_KEY</code> is set correctly in <code>.env.local</code>.<br />
            Failed at: <code className="text-red-500">{(err as any)?.message?.split('\n')[0]}</code>
          </p>
        </div>
      </main>
    );
  }

  const userTypePie = userType.map((r) => ({ name: r.type, value: r.users }));
  const platformPie = platforms.map((r) => ({ name: r.platform, value: r.users }));

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Polled — Admin Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Firebase · Firestore + Auth · {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard label="Active Users (28d)" value={overview.activeUsers} />
        <MetricCard label="New Users (28d)"   value={overview.newUsers} />
        <MetricCard label="Event Joins"       value={overview.sessions} />
        <MetricCard label="Total Polls"       value={overview.screenPageViews} />
        <MetricCard label="Total Events"      value={overview.eventCount} />
      </div>

      {/* User activity over time */}
      <div className="mb-6">
        <UserActivityChart data={userActivity} />
      </div>

      {/* 30-day DAU */}
      <div className="mb-6">
        <DailyUsersChart data={dailyUsers} />
      </div>

      {/* DAU comparison + Day 1 Retention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <DAUComparisonChart
          labels={dauComparison.labels}
          thisWeek={dauComparison.thisWeek}
          lastWeek={dauComparison.lastWeek}
        />
        <RetentionChart
          thisWeek={day1Retention.thisWeek}
          lastWeek={day1Retention.lastWeek}
        />
      </div>

      {/* Events + Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TopEventsTable data={topEvents} />
        <TopScreensTable data={topScreens} />
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PieBreakdown title="New vs Returning Users" data={userTypePie} />
        <PieBreakdown title="Platform Breakdown"     data={platformPie} />
      </div>
    </main>
  );
}

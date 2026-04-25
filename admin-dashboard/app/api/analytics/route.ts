import { NextResponse } from 'next/server';
import {
  fetchOverview,
  fetchDailyUsers,
  fetchTopEvents,
  fetchTopScreens,
  fetchUserType,
  fetchPlatforms,
} from '@/lib/analytics';
import { isAdminAuthenticated } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Optional simple auth guard
  const secret = process.env.ADMIN_SECRET;
  if (secret) {
    const auth = request.headers.get('x-admin-secret');
    if (auth !== secret && !isAdminAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const [overview, dailyUsers, topEvents, topScreens, userType, platforms] =
      await Promise.all([
        fetchOverview(),
        fetchDailyUsers(),
        fetchTopEvents(),
        fetchTopScreens(),
        fetchUserType(),
        fetchPlatforms(),
      ]);

    return NextResponse.json({
      overview,
      dailyUsers,
      topEvents,
      topScreens,
      userType,
      platforms,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

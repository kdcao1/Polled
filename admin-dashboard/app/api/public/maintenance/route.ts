import { NextResponse } from 'next/server';
import { fetchMaintenanceState } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const maintenance = await fetchMaintenanceState();
    return NextResponse.json(
      {
        enabled: maintenance.enabled,
        message: maintenance.message || 'Polled is temporarily down for maintenance.',
        updatedAt: maintenance.updatedAt,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown maintenance status error';
    return NextResponse.json({ enabled: false, message, error: message }, { status: 500, headers: corsHeaders });
  }
}

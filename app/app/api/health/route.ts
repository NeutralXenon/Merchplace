import { NextResponse } from 'next/server';
import { getHealthConfigReport } from '@/lib/health';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const config = getHealthConfigReport(process.env);
  let database: 'ok' | 'unavailable' | 'not_configured' = config.checks.supabase
    ? 'unavailable'
    : 'not_configured';

  if (config.checks.supabase) {
    try {
      const supabase = createServerClient();
      const { error } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true });

      database = error ? 'unavailable' : 'ok';
    } catch {
      database = 'unavailable';
    }
  }

  const ok = config.ok && database === 'ok';

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      network: config.network,
      checks: {
        ...config.checks,
        database: database === 'ok',
      },
    },
    { status: ok ? 200 : 503 }
  );
}

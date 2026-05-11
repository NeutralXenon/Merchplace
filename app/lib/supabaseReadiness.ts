export type SupabaseConfigIssue = {
  severity: 'blocker' | 'warning';
  field: string;
  message: string;
};

export const REQUIRED_SUPABASE_TABLES = [
  'users',
  'listings',
  'shipping',
  'listing_events',
] as const;

export const REQUIRED_SUPABASE_BUCKET = 'listing-images';

const PLACEHOLDER_PATTERN = /(your_|your-|replace|placeholder|^<.+>$)/i;

function isBlankOrPlaceholder(value: string | undefined) {
  return !value || PLACEHOLDER_PATTERN.test(value.trim());
}

function getProjectRefFromUrl(rawUrl: string | undefined) {
  if (!rawUrl) return null;

  try {
    const { hostname } = new URL(rawUrl);
    const [projectRef, supabase, domain] = hostname.split('.');
    return supabase === 'supabase' && domain === 'co' ? projectRef : null;
  } catch {
    return null;
  }
}

function getProjectRefFromJwt(token: string | undefined) {
  if (!token || token.split('.').length < 2) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    ) as { ref?: unknown };

    return typeof payload.ref === 'string' ? payload.ref : null;
  } catch {
    return null;
  }
}

function addKeyProjectMismatchIssue(
  issues: SupabaseConfigIssue[],
  field: string,
  projectRef: string | null,
  key: string | undefined
) {
  const keyProjectRef = getProjectRefFromJwt(key);
  if (!projectRef || !keyProjectRef || projectRef === keyProjectRef) return;

  issues.push({
    severity: 'blocker',
    field,
    message: `Key belongs to Supabase project ${keyProjectRef}, but NEXT_PUBLIC_SUPABASE_URL points to ${projectRef}. Copy fresh keys from the same project as the URL.`,
  });
}

export function getSupabaseConfigIssues(
  env: Record<string, string | undefined>
): SupabaseConfigIssue[] {
  const issues: SupabaseConfigIssue[] = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  let projectRef: string | null = null;

  if (isBlankOrPlaceholder(url)) {
    issues.push({
      severity: 'blocker',
      field: 'NEXT_PUBLIC_SUPABASE_URL',
      message: 'Set this to your project URL from Supabase Dashboard > Settings > API.',
    });
  } else {
    try {
      const parsed = new URL(url ?? '');
      projectRef = getProjectRefFromUrl(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        issues.push({
          severity: 'blocker',
          field: 'NEXT_PUBLIC_SUPABASE_URL',
          message: 'Supabase URL must use http or https.',
        });
      }
    } catch {
      issues.push({
        severity: 'blocker',
        field: 'NEXT_PUBLIC_SUPABASE_URL',
        message: 'Supabase URL is not a valid URL.',
      });
    }
  }

  if (isBlankOrPlaceholder(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    issues.push({
      severity: 'blocker',
      field: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      message: 'Set this to the anon public key from Supabase Dashboard > Settings > API.',
    });
  }

  if (isBlankOrPlaceholder(env.SUPABASE_SERVICE_ROLE_KEY)) {
    issues.push({
      severity: 'blocker',
      field: 'SUPABASE_SERVICE_ROLE_KEY',
      message: 'Set this to the service_role key from Supabase Dashboard > Settings > API.',
    });
  }

  addKeyProjectMismatchIssue(
    issues,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    projectRef,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  addKeyProjectMismatchIssue(
    issues,
    'SUPABASE_SERVICE_ROLE_KEY',
    projectRef,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  return issues;
}

export function maskSupabaseOrigin(rawUrl: string | undefined) {
  if (!rawUrl) return 'missing Supabase URL';

  try {
    const parsed = new URL(rawUrl);
    const [projectRef, ...rest] = parsed.hostname.split('.');
    const maskedRef =
      projectRef.length <= 8
        ? `${projectRef.slice(0, 2)}...`
        : `${projectRef.slice(0, 4)}...${projectRef.slice(-4)}`;

    return `${parsed.protocol}//${[maskedRef, ...rest].join('.')}`;
  } catch {
    return 'invalid Supabase URL';
  }
}

export function getSupabaseErrorHint(error: unknown) {
  const details =
    typeof error === 'object' && error
      ? {
          code: 'code' in error ? String(error.code) : '',
          message: 'message' in error ? String(error.message) : '',
          hostname: 'hostname' in error ? String(error.hostname) : '',
        }
      : { code: '', message: String(error), hostname: '' };

  const combined = `${details.code} ${details.message}`.toLowerCase();

  if (details.code === 'ENOTFOUND' || combined.includes('enotfound')) {
    const host = details.hostname ? ` (${details.hostname})` : '';
    return `Supabase project host could not be resolved${host}. Check NEXT_PUBLIC_SUPABASE_URL in Supabase Dashboard > Settings > API, then replace the local URL and keys.`;
  }

  if (
    combined.includes('relation') && combined.includes('does not exist') ||
    combined.includes('schema cache')
  ) {
    return 'Supabase is reachable, but the database schema is missing. Run app/supabase/schema.sql in the Supabase SQL editor.';
  }

  if (combined.includes('bucket') && combined.includes('not found')) {
    return `Supabase is reachable, but storage bucket "${REQUIRED_SUPABASE_BUCKET}" is missing. Create it in Supabase Storage and make it public.`;
  }

  if (combined.includes('jwt') || combined.includes('invalid api key')) {
    return 'Supabase rejected the API key. Refresh the anon and service_role keys from Supabase Dashboard > Settings > API.';
  }

  return 'Supabase check failed. Verify the project URL, API keys, schema, and storage bucket.';
}

export function getSupabaseSetupSteps() {
  return [
    'Create or open a Supabase project and copy the Project URL, anon key, and service_role key from Settings > API.',
    'Update app/.env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.',
    'Run app/supabase/schema.sql in the Supabase SQL editor.',
    `Confirm the public Storage bucket named "${REQUIRED_SUPABASE_BUCKET}" exists; schema.sql creates it automatically.`,
    'Restart the Next.js dev server so it picks up the new environment.',
    'Run npm run supabase:check from app/ to verify tables and storage.',
  ];
}

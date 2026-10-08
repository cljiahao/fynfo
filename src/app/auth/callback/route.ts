import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? PAGE_ROUTES.DASHBOARD;
  const destination = new URL(PAGE_ROUTES.DASHBOARD, origin);
  if (
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !/[\\\u0000-\u001f\u007f]/.test(next)
  ) {
    const candidate = new URL(next, origin);
    if (candidate.origin === origin) {
      destination.href = candidate.href;
    }
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(
    `${origin}${PAGE_ROUTES.LOGIN}?error=auth_callback_failed`
  );
}

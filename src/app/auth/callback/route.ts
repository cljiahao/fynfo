import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? PAGE_ROUTES.DASHBOARD;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}${PAGE_ROUTES.LOGIN}?error=auth_callback_failed`
  );
}

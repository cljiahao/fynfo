import { API_ROUTES, PAGE_ROUTES } from '@/lib/constants/routes';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set<string>([
  PAGE_ROUTES.HOME,
  PAGE_ROUTES.LOGIN,
  PAGE_ROUTES.AUTH_CALLBACK,
]);
const PUBLIC_API_PREFIXES = [API_ROUTES.HEALTH];

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

export async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;
  const { pathname } = req.nextUrl;

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    if (isApiRoute(pathname)) {
      return new Response(null, { status: 401 });
    }
    return NextResponse.redirect(new URL(PAGE_ROUTES.LOGIN, req.url));
  }

  // Prevent logged-in users from hitting the login page
  if (isAuthenticated && pathname === PAGE_ROUTES.LOGIN) {
    return NextResponse.redirect(new URL(PAGE_ROUTES.DASHBOARD, req.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)',
  ],
};

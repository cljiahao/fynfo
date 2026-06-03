import { getSupabaseEnv } from '@/lib/constants/env';
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

/**
 * A Next.js server action (POST carrying the `next-action` header). These
 * self-validate auth via `requireActionContext`/`requireDbContext` and rotate
 * the session cookie through their own Supabase client, so the proxy's
 * `getUser()` pass on them is a redundant auth round-trip. Fails secure: any
 * request this does not positively classify still gets the full proxy pass.
 */
export function isServerActionRequest(
  method: string,
  headers: Headers
): boolean {
  return method === 'POST' && headers.has('next-action');
}

export async function proxy(req: NextRequest) {
  // Skip the redundant auth/refresh pass on self-guarded server actions.
  if (isServerActionRequest(req.method, req.headers)) {
    return NextResponse.next({ request: req });
  }

  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: req,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

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

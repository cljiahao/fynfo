import { PAGE_ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';

// Server Component: the storefront navbar is pure links with no interactivity,
// so it ships zero client JS. The authenticated navbar (mobile Sheet, active-link
// highlight) lives in dashboard-navbar.tsx and is never imported here, keeping
// radix Dialog / useState / Menu out of the public route bundle.
export function PublicNavbar() {
  return (
    <nav className="max-w-site fixed inset-x-0 top-0 z-50 mx-auto px-6 pt-6">
      <div className="flex-between min-h-16 rounded-2xl border border-white/10 bg-zinc-950/60 px-6 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl md:px-8">
        <Link
          href={PAGE_ROUTES.HOME}
          className="text-xl font-bold tracking-tight md:text-2xl"
        >
          <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
            Fyn
          </span>
          <span className="text-white">fo</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/#features"
            className="hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:inline"
          >
            Features
          </Link>
          <Link
            href="/#faq"
            className="hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:inline"
          >
            FAQ
          </Link>
          <Link
            href={PAGE_ROUTES.LOGIN}
            className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}

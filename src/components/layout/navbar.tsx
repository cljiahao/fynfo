'use client';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { BrandText } from '@/components/widgets';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: PAGE_ROUTES.DASHBOARD, exact: true },
  { label: 'Assets', href: PAGE_ROUTES.ASSETS, exact: false },
  { label: 'Salary', href: PAGE_ROUTES.SALARY, exact: false },
  { label: 'Equity', href: PAGE_ROUTES.EQUITY, exact: false },
  { label: 'Expenses', href: PAGE_ROUTES.EXPENSES, exact: false },
] as const;

export function Navbar({ userMenu }: { userMenu?: React.ReactNode }) {
  const pathname = usePathname();
  const rootPath = `/${pathname.split('/')[1]}`;
  const isDashboard = rootPath === PAGE_ROUTES.DASHBOARD;
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  // Public navbar — shown on landing page and login
  if (!isDashboard) {
    return (
      <nav className="max-w-site fixed inset-x-0 top-0 z-50 mx-auto pt-10">
        <div className="flex-between min-h-20 rounded-2xl border bg-white px-6 py-3 shadow-lg md:px-8">
          <Link
            href={PAGE_ROUTES.HOME}
            onClick={() => window.scrollTo({ top: 0 })}
            className="text-xl font-bold tracking-tight md:text-2xl"
          >
            <BrandText />
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/#features"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors sm:inline"
            >
              Features
            </Link>
            <Link
              href="/#faq"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors sm:inline"
            >
              FAQ
            </Link>
            <Link href={PAGE_ROUTES.LOGIN}>
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // Authenticated navbar — shown on dashboard pages
  return (
    <nav className="sticky top-0 z-50 w-full">
      <div className="flex-between min-h-20 border-b bg-white px-6 py-3 shadow-lg md:px-8">
        <Link
          href={PAGE_ROUTES.HOME}
          onClick={() => window.scrollTo({ top: 0 })}
          className="text-xl font-bold tracking-tight md:text-2xl"
        >
          <BrandText />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative px-3 py-2 text-sm font-medium transition-colors',
                isActive(item)
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
              {isActive(item) && (
                <span className="bg-foreground absolute inset-x-1 -bottom-3 h-0.5 rounded-full" />
              )}
            </Link>
          ))}

          {userMenu && (
            <>
              <div className="bg-border mx-2 h-6 w-px" />
              {userMenu}
            </>
          )}
        </div>

        {/* Mobile nav */}
        <div className="flex items-center gap-2 md:hidden">
          {userMenu}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="size-9 border-0 shadow-none">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>
                  <span className="text-brand-gradient">Wealth</span>
                  <span>Pulse</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 pt-4">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive(item)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

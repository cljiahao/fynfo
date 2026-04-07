import { Navbar, SiteFooter } from '@/components/layout';
import { UserMenu } from '@/components/layout/user-menu';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar userMenu={<UserMenu />} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}

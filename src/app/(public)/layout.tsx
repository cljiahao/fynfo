import { PublicNavbar, SiteFooter } from '@/components/layout';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter tone="marketing" />
    </div>
  );
}

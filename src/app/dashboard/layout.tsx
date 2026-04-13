import { Navbar, SiteFooter } from '@/components/layout';
import { UserMenu } from '@/components/layout/user-menu';
import { VaultUnlockFlow } from '@/features/auth';
import { cookies } from 'next/headers';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isVaultLocked = !cookieStore.has('fynfo_vault_dek');

  return (
    <div className="flex min-h-screen flex-col">
      {isVaultLocked && <VaultUnlockFlow />}
      <Navbar userMenu={<UserMenu />} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}

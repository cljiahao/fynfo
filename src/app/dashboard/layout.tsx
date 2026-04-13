import { Navbar, SiteFooter } from '@/components/layout';
import { UserMenu } from '@/components/layout/user-menu';
import { VaultUnlockFlow } from '@/features/auth';
import { getVaultDekSession } from '@/lib/keystore';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dek = await getVaultDekSession();
  const isVaultLocked = !dek;

  return (
    <div className="flex min-h-screen flex-col">
      {isVaultLocked && <VaultUnlockFlow />}
      <Navbar userMenu={<UserMenu />} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}

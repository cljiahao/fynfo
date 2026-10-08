import { DashboardNavbar, SiteFooter, VaultGate } from '@/components/layout';
import { UserMenu } from '@/components/layout/user-menu';
import { IdleLockWatcher, VaultLockProvider } from '@/features/auth';
import { requireUserId } from '@/lib/auth-guard';
import { getVaultDekSession } from '@/lib/keystore';

async function checkVaultUnlocked(): Promise<boolean> {
  const userId = await requireUserId();
  const dek = await getVaultDekSession(userId);
  return dek !== null;
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isVaultUnlocked = await checkVaultUnlocked();

  return (
    <VaultLockProvider initiallyUnlocked={isVaultUnlocked}>
      <IdleLockWatcher />
      <VaultGate>
        <div className="flex min-h-screen flex-col">
          <DashboardNavbar userMenu={<UserMenu />} />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </div>
      </VaultGate>
    </VaultLockProvider>
  );
}

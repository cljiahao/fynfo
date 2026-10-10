import { DashboardNavbar, SiteFooter, VaultGate } from '@/components/layout';
import { UserMenu } from '@/components/layout/user-menu';
import {
  AuthIdentityWatcher,
  IdleLockWatcher,
  VaultLockProvider,
} from '@/features/auth';
import { requireUserId } from '@/lib/auth-guard';
import { getVaultDekSession } from '@/lib/keystore';

async function getVaultIdentity() {
  const userId = await requireUserId();
  const dek = await getVaultDekSession(userId);
  return { userId, isVaultUnlocked: dek !== null };
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, isVaultUnlocked } = await getVaultIdentity();

  return (
    <VaultLockProvider initiallyUnlocked={isVaultUnlocked} userId={userId}>
      <AuthIdentityWatcher userId={userId} />
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

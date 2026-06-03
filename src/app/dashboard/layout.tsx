import { Navbar, SiteFooter, VaultGate } from '@/components/layout';
import { UserMenu } from '@/components/layout/user-menu';
import { IdleLockWatcher, VaultLockProvider } from '@/features/auth';
import { getVaultDekSession } from '@/lib/keystore';

// The proxy middleware already verified the Supabase session. The DEK cookie is
// HttpOnly and AES-256-GCM encrypted with SESSION_SECRET — if it decrypts, the
// vault was legitimately unlocked. No DB round-trip needed on every page load.
async function checkVaultUnlocked(): Promise<boolean> {
  const dek = await getVaultDekSession();
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
      <div className="flex min-h-screen flex-col">
        <VaultGate />
        <IdleLockWatcher />
        <Navbar userMenu={<UserMenu />} />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </div>
    </VaultLockProvider>
  );
}

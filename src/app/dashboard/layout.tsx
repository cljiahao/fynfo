import { Navbar, SiteFooter } from '@/components/layout';
import { UserMenu } from '@/components/layout/user-menu';
import { VaultUnlockFlow } from '@/features/auth';
import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { decryptPayload } from '@/lib/crypto';
import { getVaultDekSession } from '@/lib/keystore';

const VAULT_CANARY = 'fynfo_vault_ok';

async function checkVaultUnlocked(): Promise<boolean> {
  // Step 1: DEK must exist and decrypt from the session cookie
  const dek = await getVaultDekSession();
  if (!dek) return false;

  try {
    // Step 2: Fetch the stored canary from Supabase
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('users_profile')
      .select('vault_check')
      .eq('id', user.id)
      .single();

    // No canary yet means first-time setup — force PIN entry to set it
    if (!profile?.vault_check) return false;

    // Step 3: Decrypt the canary with the DEK — wrong PIN produces ""
    const decrypted = await decryptPayload(profile.vault_check, dek);
    return decrypted === VAULT_CANARY;
  } catch {
    return false;
  }
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isVaultUnlocked = await checkVaultUnlocked();

  return (
    <div className="flex min-h-screen flex-col">
      {!isVaultUnlocked && <VaultUnlockFlow />}
      <Navbar userMenu={<UserMenu />} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}

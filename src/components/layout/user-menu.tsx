import { auth } from '@/auth';
import { UserMenuDropdown } from './user-menu-dropdown';

export async function UserMenu() {
  let session;
  try {
    session = await auth();
  } catch {
    return null;
  }

  if (!session?.user) return null;

  return (
    <UserMenuDropdown
      name={session.user.name ?? undefined}
      email={session.user.email ?? undefined}
      image={session.user.image ?? undefined}
    />
  );
}

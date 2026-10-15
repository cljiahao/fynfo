import { LoginCard } from '@/features/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex-center min-h-screen px-4 pt-28 pb-10">
      <LoginCard callbackFailed={error === 'auth_callback_failed'} />
    </div>
  );
}

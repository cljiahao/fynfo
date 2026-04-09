'use client';

import { CustomCard } from '@/components/widgets';
import { isDev } from '@/lib/constants/env';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { LoginButton } from './login-button';

export function LoginCard() {
  return (
    <CustomCard
      header={
        <>
          <span className="text-brand-gradient">Fyn</span>
          <span>fo</span>
        </>
      }
      description="Sign in to access your dashboard"
      className="w-full max-w-md shadow-lg"
      contentClassName="flex flex-col gap-4 px-8 py-6"
    >
      <LoginButton
        provider="google"
        redirectTo={PAGE_ROUTES.DASHBOARD}
        label="Sign in with Google"
        className="py-6 text-lg"
      />
      {isDev && (
        <LoginButton
          className="border-2 bg-white py-4 text-sm text-gray-500 hover:bg-gray-300"
          provider="credentials"
          redirectTo={PAGE_ROUTES.DASHBOARD}
          label="Dev login (bypass auth)"
        />
      )}
    </CustomCard>
  );
}

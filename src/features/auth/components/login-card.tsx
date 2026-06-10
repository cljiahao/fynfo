'use client';

import { CustomCard } from '@/components/widgets';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { EmailLoginForm } from './email-login-form';
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
        redirectTo={`${PAGE_ROUTES.AUTH_CALLBACK}?next=${PAGE_ROUTES.DASHBOARD}`}
        label="Sign in with Google"
        className="py-6 text-lg"
      />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs uppercase">or</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <EmailLoginForm />
    </CustomCard>
  );
}

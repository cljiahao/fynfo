import { PageHeader } from '@/components/widgets';
import { CallersManager } from '@/features/investment-api';

export default function ApiCallersPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="API callers"
        description="Register the services allowed to use your investment API and rotate or revoke their keys"
      />
      <CallersManager />
    </div>
  );
}

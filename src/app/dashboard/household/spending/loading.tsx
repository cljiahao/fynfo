import { HouseholdSkeleton } from '@/features/household';

export default function HouseholdSpendingLoading() {
  return (
    <div className="max-w-site mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">
      <HouseholdSkeleton />
    </div>
  );
}

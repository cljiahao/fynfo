import { GoalDetailSkeleton } from '@/features/household';

export default function GoalDetailLoading() {
  return (
    <div className="max-w-site mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">
      <GoalDetailSkeleton />
    </div>
  );
}

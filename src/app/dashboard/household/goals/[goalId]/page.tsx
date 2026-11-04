import { GoalDetail } from '@/features/household';

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const { goalId } = await params;
  return (
    <div className="max-w-site mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">
      <GoalDetail goalId={goalId} />
    </div>
  );
}

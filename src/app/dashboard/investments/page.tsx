import { getJournalTimeline, TimelineList } from '@/features/investment-api';
import { WeeklyBudgetForm } from './weekly-budget-form';

export const dynamic = 'force-dynamic';

async function Timeline() {
  let events;
  try {
    events = await getJournalTimeline();
  } catch {
    // The same opaque message covers a locked vault and a failed read.
    return (
      <p className="text-muted-foreground text-sm">
        The timeline is unavailable. Unlock your vault and reload.
      </p>
    );
  }
  return <TimelineList events={events} />;
}

export default function InvestmentsPage() {
  return (
    <div className="max-w-site mx-auto w-full space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold">Investments</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Weekly budget</h2>
        <WeeklyBudgetForm />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Journal timeline</h2>
        <Timeline />
      </section>
    </div>
  );
}

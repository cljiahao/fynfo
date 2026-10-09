'use client';

import { Button } from '@/components/ui/button';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

const DISMISSED_KEY = 'fynfo-first-record-dismissed';
const DISMISSED_EVENT = 'fynfo-first-record-dismissed';

function subscribe(callback: () => void) {
  window.addEventListener(DISMISSED_EVENT, callback);
  return () => window.removeEventListener(DISMISSED_EVENT, callback);
}

function isDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function FirstRecordPrompt() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  const [dismissedHere, setDismissedHere] = useState(false);
  if (dismissed || dismissedHere) return null;

  return (
    <section
      aria-labelledby="first-record-title"
      className="border-border space-y-3 rounded-xl border p-5"
    >
      <h2 id="first-record-title" className="text-lg font-semibold">
        Start with your current assets
      </h2>
      <p className="text-muted-foreground text-sm">
        Add one snapshot to see your financial overview. You can fill in the
        rest later.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href={PAGE_ROUTES.ENTRY}>Add your first snapshot</Link>
        </Button>
        <Link
          href={PAGE_ROUTES.EXPENSES}
          className="text-sm underline underline-offset-4"
        >
          Start with an expense
        </Link>
        <Link
          href={PAGE_ROUTES.SALARY}
          className="text-sm underline underline-offset-4"
        >
          Start with salary
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            setDismissedHere(true);
            try {
              sessionStorage.setItem(DISMISSED_KEY, 'true');
            } catch {
              /* Storage can be unavailable in private browsing. */
            }
            window.dispatchEvent(new Event(DISMISSED_EVENT));
          }}
        >
          Skip
        </Button>
      </div>
    </section>
  );
}

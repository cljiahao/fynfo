'use client';

import { usePublishSummaryOnUnlock } from '../hooks/use-publish-on-unlock';

/** Renders nothing; mounted once inside the unlocked dashboard so the summary stays fresh. */
export function TimelineSummaryPublisher({ userId }: { userId: string }) {
  usePublishSummaryOnUnlock(userId);
  return null;
}

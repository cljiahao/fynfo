'use client';

import { OverviewReadContext } from '@/lib/overview-read-context';
import { useState, type ReactNode } from 'react';
import { getOverviewReads } from '../actions/overview-actions';
import { createOverviewReadCohorts } from '../lib/read-cohorts';

export function OverviewReadProvider({ children }: { children: ReactNode }) {
  const [transport] = useState(() =>
    createOverviewReadCohorts(getOverviewReads)
  );
  return (
    <OverviewReadContext.Provider value={transport}>
      {children}
    </OverviewReadContext.Provider>
  );
}

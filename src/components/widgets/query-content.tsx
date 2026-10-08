'use client';

import { useState, type ReactNode } from 'react';

export function QueryContent({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  const [hasLoaded, setHasLoaded] = useState(ready);
  if (ready && !hasLoaded) setHasLoaded(true);

  // Preserve unsaved local edits across a temporary background read failure.
  return hasLoaded ? <div hidden={!ready}>{children}</div> : null;
}

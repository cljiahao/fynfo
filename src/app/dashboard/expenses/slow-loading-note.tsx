'use client';

import { useEffect, useState } from 'react';

const SLOW_AFTER_MS = 4000;

// Client-only so the surrounding skeleton can stay a Server Component for loading.tsx.
export function SlowLoadingNote() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return slow ? (
    <span> Still loading, this can take a few more seconds.</span>
  ) : null;
}

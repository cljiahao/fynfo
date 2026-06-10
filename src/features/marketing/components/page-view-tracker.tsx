'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { trackEvent } from '../lib/track';

/**
 * Records a single `page_view` per pathname on mount. Renders nothing.
 * `'use client'`: depends on the browser (fetch beacon + pathname).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    trackEvent('page_view', pathname);
  }, [pathname]);

  return null;
}

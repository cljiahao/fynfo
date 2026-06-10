'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { trackEvent } from '../lib/track';

type TrackedCtaLinkProps = ComponentProps<typeof Link>;

/**
 * Drop-in replacement for next/link that fires a `cta_click` beacon before
 * navigating. `'use client'`: needs the click handler + browser location.
 */
export function TrackedCtaLink({ onClick, ...props }: TrackedCtaLinkProps) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackEvent('cta_click', window.location.pathname);
        onClick?.(e);
      }}
    />
  );
}

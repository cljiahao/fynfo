'use client';

import { domAnimation, LazyMotion } from 'framer-motion';
import type { ReactNode } from 'react';

// Loads only framer-motion's `domAnimation` feature set (animations, variants,
// whileInView) instead of the full `motion` bundle (~34KB → ~4.6KB baseline +
// domAnimation). All marketing motion users render the lightweight `m` component
// inside this boundary. `strict` makes any stray `motion` usage throw so the
// heavy bundle can never sneak back onto the storefront critical path.
// Features load synchronously to keep the above-the-fold Hero flash-free.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

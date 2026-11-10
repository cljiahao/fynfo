'use client';

import dynamic from 'next/dynamic';

// Lazy so the dump tool stays in its own chunk instead of the expenses page
// chunk that shares this barrel; only the admin dump page requests it.
export const OcrDump = dynamic(
  () => import('./ocr-dump').then((module) => module.OcrDump),
  { ssr: false }
);

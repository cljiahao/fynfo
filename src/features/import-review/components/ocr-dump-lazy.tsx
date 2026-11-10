'use client';

import dynamic from 'next/dynamic';

// The literal NODE_ENV comparison lets the bundler drop the import() in a
// production build, so the dump component never ships to users.
export const OcrDump =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./ocr-dump').then((module) => module.OcrDump), {
        ssr: false,
      })
    : () => null;

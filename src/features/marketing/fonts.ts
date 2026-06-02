import { Fraunces } from 'next/font/google';

/**
 * Editorial display serif for the marketing headlines. High-contrast, optical —
 * a premium, characterful counterpoint to the app's Lato body + Geist Mono
 * data. Scoped to the landing via its className (not the app-wide font stack).
 */
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

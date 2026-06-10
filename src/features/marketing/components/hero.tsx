'use client';

import { PAGE_ROUTES } from '@/lib/constants/routes';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { TRUST_BADGES } from '../constants';
import { fraunces } from '../fonts';
import { DashboardPreview } from './dashboard-preview';
import { TrackedCtaLink } from './tracked-cta-link';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

export function Hero() {
  const reduce = useReducedMotion();
  // initial={false} renders straight at the "show" state (no mount animation),
  // so reduced-motion users see the hero immediately instead of a stuck
  // opacity:0 from SSR. Non-reduced users still get the staggered entrance.
  const motionProps = {
    variants: container,
    initial: reduce ? false : ('hidden' as const),
    animate: 'show' as const,
  };
  const child = { variants: item };

  return (
    <section className="relative overflow-hidden px-6 pt-40 pb-24 md:pb-32">
      {/* mesh-gradient atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute top-1/3 right-[-10%] size-[32rem] rounded-full bg-sky-500/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] size-[32rem] rounded-full bg-emerald-400/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-[size:56px_56px]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div {...motionProps}>
          <motion.div {...child}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
              <ShieldCheck className="size-3.5 text-emerald-300" />
              Zero-knowledge personal wealth
            </span>
          </motion.div>

          <motion.h1
            {...child}
            className={`${fraunces.className} mt-6 text-5xl leading-[1.05] font-medium tracking-tight text-white md:text-6xl lg:text-7xl`}
          >
            Your wealth,
            <br />
            <span className="bg-gradient-to-r from-emerald-200 via-emerald-300 to-sky-300 bg-clip-text text-transparent italic">
              one pulse away
            </span>
          </motion.h1>

          <motion.p
            {...child}
            className="mt-6 max-w-md text-lg leading-relaxed text-white/60"
          >
            Track your assets, salary, taxes, CPF, and portfolio in one private
            place. Encrypted on your device — even we can&apos;t read it.
          </motion.p>

          <motion.div
            {...child}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <TrackedCtaLink
              href={PAGE_ROUTES.LOGIN}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              Get started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </TrackedCtaLink>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              Learn more
            </Link>
          </motion.div>

          <motion.div
            {...child}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/40"
          >
            {TRUST_BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-emerald-400" />
                {b}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40, rotate: -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: -1.5 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}

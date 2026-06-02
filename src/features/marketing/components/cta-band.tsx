import { PAGE_ROUTES } from '@/lib/constants/routes';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { fraunces } from '../fonts';
import { Reveal } from './reveal';

export function CtaBand() {
  return (
    <section className="px-6 pb-28">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 px-8 py-16 text-center md:py-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/20 via-zinc-900 to-sky-500/15"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_60%)]"
        />
        <h2
          className={`${fraunces.className} mx-auto max-w-xl text-4xl font-medium tracking-tight text-white md:text-5xl`}
        >
          Ready to take control?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-white/60">
          Start tracking your wealth today. It only takes a minute — and
          it&apos;s free.
        </p>
        <Link
          href={PAGE_ROUTES.LOGIN}
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
        >
          Get started
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Reveal>
    </section>
  );
}

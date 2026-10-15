import { MOAT_POINTS } from '../constants';
import { Reveal } from './reveal';

export function MoatBand() {
  return (
    <section id="why" className="scroll-mt-28 px-4 py-14 sm:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Built on what we refuse to do
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Most finance apps want more of your data. Fynfo wants less — and
            that is the point.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-3">
          {MOAT_POINTS.map((point, i) => (
            <Reveal key={point.title} delay={i * 0.08}>
              <div className="h-full border-t border-white/15 pt-6">
                <div className="inline-flex text-emerald-300">
                  <point.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {point.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

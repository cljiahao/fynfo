import { MOAT_POINTS } from '../constants';
import { Reveal } from './reveal';

export function MoatBand() {
  return (
    <section id="why" className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wide text-emerald-300 uppercase">
            Why Fynfo
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Built on what we refuse to do
          </h2>
          <p className="mt-4 text-lg text-white/55">
            Most finance apps want more of your data. Fynfo wants less — and
            that is the point.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {MOAT_POINTS.map((point, i) => (
            <Reveal key={point.title} delay={i * 0.08}>
              <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]">
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-sky-400/10 text-emerald-300 ring-1 ring-white/10">
                  <point.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
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

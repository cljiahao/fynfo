import { FEATURES } from '../constants';
import { Reveal } from './reveal';

export function FeatureGrid() {
  return (
    <section id="features" className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Everything you need
          </h2>
          <p className="mt-4 text-lg text-white/55">
            A complete wealth toolkit — built for clarity, not clutter.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 0.08}>
              <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]">
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-sky-400/10 text-emerald-300 ring-1 ring-white/10">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

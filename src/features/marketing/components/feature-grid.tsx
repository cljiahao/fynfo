import { FEATURES } from '../constants';
import { Reveal } from './reveal';

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-28 px-4 py-14 sm:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Everything you need
          </h2>
          <p className="mt-4 text-lg text-white/70">
            A complete wealth toolkit — built for clarity, not clutter.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 0.08}>
              <div className="h-full border-t border-white/15 pt-6">
                <div className="inline-flex text-emerald-300">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
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

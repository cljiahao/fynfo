import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { Reveal } from './reveal';

const POINTS = [
  {
    icon: Lock,
    title: 'Encrypted in storage',
    body: 'Your browser derives a key from your PIN. The server uses that key to encrypt and decrypt your financial data.',
  },
  {
    icon: KeyRound,
    title: 'PIN-derived access',
    body: 'The derived key is sent to the server for your unlocked session. Your PIN stays in your browser; keep it safe to retain access.',
  },
  {
    icon: ShieldCheck,
    title: 'Yours to take',
    body: 'Download your personal records as JSON from your profile. The export lists its included domains.',
  },
];

export function SecurityBand() {
  return (
    <section className="scroll-mt-28 px-4 py-14 sm:px-6 md:py-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden border-y border-white/10 py-10 md:py-16">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Encrypted in the database. Unlocked with your PIN.
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Your PIN derives the key in your browser. During an unlocked
            session, Fynfo&apos;s server receives that key and processes your
            records to display and save them.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="inline-flex text-emerald-300">
                <p.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {p.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

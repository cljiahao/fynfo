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
    <section className="px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-10 md:p-16">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-72 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <Reveal className="max-w-2xl">
          <p className="text-sm font-medium tracking-wide text-emerald-300 uppercase">
            Vault encryption
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Encrypted in the database. Unlocked with your PIN.
          </h2>
          <p className="mt-4 text-lg text-white/55">
            Your PIN derives the key in your browser. During an unlocked
            session, Fynfo&apos;s server receives that key and processes your
            records to display and save them.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="inline-flex size-10 items-center justify-center rounded-lg bg-white/5 text-emerald-300 ring-1 ring-white/10">
                <p.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {p.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

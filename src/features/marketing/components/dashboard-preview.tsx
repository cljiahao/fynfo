import { ArrowUpRight, TrendingUp } from 'lucide-react';

const MONO = '[font-family:var(--font-geist-mono)]';

const STATS = [
  { label: 'Savings', value: '$182,400' },
  { label: 'Investments', value: '$241,900' },
  { label: 'This month', value: '+$6,180' },
];

// Static, illustrative net-worth curve (not real data).
const AREA =
  'M0,96 C40,90 70,72 110,70 C150,68 175,82 210,70 C250,56 270,30 320,28 C360,26 380,18 400,14';
const FILL = `${AREA} L400,120 L0,120 Z`;

/** Purely decorative product glimpse for the hero — no data, no interactivity. */
export function DashboardPreview() {
  return (
    <div className="relative">
      {/* glow */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[2rem] bg-emerald-400/15 blur-3xl"
      />
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-6">
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-white/50 uppercase">
              Net worth
            </p>
            <p className={`mt-1 text-3xl font-semibold text-white ${MONO}`}>
              $486,200
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20">
            <TrendingUp className="size-3" />
            +4.2%
          </span>
        </div>

        {/* chart */}
        <div className="relative mt-5 h-28">
          <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id="fynfo-area" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="rgb(52 211 153)"
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(52 211 153)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <path d={FILL} fill="url(#fynfo-area)" />
            <path
              d={AREA}
              fill="none"
              stroke="rgb(110 231 183)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="400" cy="14" r="4" fill="rgb(167 243 208)" />
            <circle
              cx="400"
              cy="14"
              r="8"
              fill="none"
              stroke="rgb(110 231 183)"
              strokeOpacity="0.4"
            />
          </svg>
        </div>

        {/* stat tiles */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-white/5 bg-white/[0.03] p-3"
            >
              <p className="text-[10px] font-medium tracking-wide text-white/40 uppercase">
                {s.label}
              </p>
              <p className={`mt-1 text-sm font-semibold text-white/90 ${MONO}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* footer row */}
        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
          <span className="text-xs text-white/45">Q2 deployment on track</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300">
            View plan
            <ArrowUpRight className="size-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

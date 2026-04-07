import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  PiggyBank,
} from 'lucide-react';
import Link from 'next/link';

const FEATURES = [
  {
    icon: PiggyBank,
    title: 'Asset Tracking',
    description:
      'Track savings, bonds, stocks, ETFs, crypto, and pension across all your accounts in monthly snapshots.',
  },
  {
    icon: Calculator,
    title: 'Salary, Tax & CPF',
    description:
      'Automatic Singapore tax bracket and CPF calculations with profile-aware reliefs. See your true take-home pay.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Equity Portfolio',
    description:
      'Log trades across brokers with auto-calculated fees. Track holdings, gains, and quarterly deployment targets.',
  },
  {
    icon: BarChart3,
    title: 'Investment Planning',
    description:
      'Allocate your salary into savings, expenses, and investments. Set emergency fund and war chest goals.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Is Fynfo free to use?',
    answer:
      'Yes, Fynfo is completely free for personal use. There are no premium tiers or hidden fees.',
  },
  {
    question: 'Is my financial data secure?',
    answer:
      'Your data is stored securely in an encrypted database and is only accessible to your authenticated account. We never share your data with third parties.',
  },
  {
    question: 'Is this only for Singapore residents?',
    answer:
      'The tax and CPF calculations are tailored for Singapore, but the asset tracking, equity portfolio, and investment planning features work for anyone.',
  },
  {
    question: 'Can I import my existing data?',
    answer:
      'Yes, you can import asset snapshots via JSON. For salary and equity trades, you can add records manually or in bulk.',
  },
  {
    question: 'How are tax reliefs calculated?',
    answer:
      'Fynfo uses your profile (birth year, NSMan status, residency) to automatically compute earned income relief and NSMan relief. You can also toggle additional reliefs like spouse, child, parent, and SRS on the salary page.',
  },
  {
    question: 'What brokers are supported for equity fee calculation?',
    answer:
      'We support Tiger Brokers, Moomoo, DBS Vickers, and IBKR with automatic fee calculation for both SG and US markets. You can always override fees manually.',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex-center min-h-screen flex-col gap-6 px-6 text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Your wealth,{' '}
          <span className="text-brand-gradient">one pulse away</span>
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg md:text-xl">
          Track your assets, salary, taxes, CPF, and investment portfolio — all
          in one place. Built for Singapore.
        </p>
        <div className="flex gap-3 pt-2">
          <Link href={PAGE_ROUTES.LOGIN}>
            <Button size="lg" className="text-base">
              Get Started
            </Button>
          </Link>
          <Link href="#features">
            <Button variant="outline" size="lg" className="text-base">
              Learn More
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/50 px-6 py-20 md:py-28">
        <div className="max-w-site mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-lg">
              A complete wealth management toolkit designed for your financial
              journey.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="bg-primary/10 text-primary flex-center mb-4 size-10 rounded-lg">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 md:py-28">
        <div className="max-w-content mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-lg">
              Got questions? We have answers.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/50 px-6 py-20 md:py-28">
        <div className="flex-center flex-col gap-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to take control?
          </h2>
          <p className="text-muted-foreground max-w-md text-lg">
            Start tracking your wealth today. It only takes a minute.
          </p>
          <Link href={PAGE_ROUTES.LOGIN} className="pt-2">
            <Button size="lg" className="text-base">
              Get Started — It&apos;s Free
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  EyeOff,
  PenLine,
  PiggyBank,
  Unplug,
  type LucideIcon,
} from 'lucide-react';

export interface MarketingFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FEATURES: MarketingFeature[] = [
  {
    icon: PiggyBank,
    title: 'Asset tracking',
    description:
      'Savings, bonds, stocks, ETFs, crypto, and pension across every account — captured as monthly snapshots you can trust.',
  },
  {
    icon: Calculator,
    title: 'Salary, tax & CPF',
    description:
      'Automatic Singapore tax-bracket and CPF maths with profile-aware reliefs. See your real take-home, not a guess.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Equity portfolio',
    description:
      'Log trades with auto-calculated broker fees. Track holdings, gains, and quarterly deployment targets per market.',
  },
  {
    icon: BarChart3,
    title: 'Investment planning',
    description:
      'Split your income into savings, expenses, and investments. Set emergency-fund and war-chest goals, then track them.',
  },
];

export interface MoatPoint {
  icon: LucideIcon;
  title: string;
  description: string;
}

// The "why Fynfo" upsell. Deliberately distinct from SecurityBand (which sells
// the encryption mechanics) — these sell the product philosophy: best-effort,
// no bank sync, not your data for sale.
export const MOAT_POINTS: MoatPoint[] = [
  {
    icon: Unplug,
    title: 'No bank logins, ever',
    description:
      'Fynfo does not connect to your bank or brokerage accounts or collect their login credentials. You capture the figures you want to track, when it matters.',
  },
  {
    icon: PenLine,
    title: 'Best-effort, by design',
    description:
      'A clear personal ledger, not a bank statement. Entering your own figures means you actually understand your money — and own every number in it, instead of trusting a sync you can not see.',
  },
  {
    icon: EyeOff,
    title: 'Never the product',
    description:
      'Your finances are not something we sell. No ads, no data brokers, no tracking pixels on your numbers — the opposite of a "free" finance app that monetises you.',
  },
];

export const TRUST_BADGES: string[] = [
  'PIN-derived vault key',
  'AES-256 encrypted',
  'Built for Singapore',
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Is Fynfo free to use?',
    answer:
      'Fynfo is free while we are in early access — no ads, no selling your data, no premium tier today. If that ever changes, you will hear about it well in advance, and your data always stays yours to export.',
  },
  {
    question: 'Why does not Fynfo sync my bank accounts?',
    answer:
      'You enter snapshots yourself, so Fynfo does not need your bank or brokerage login credentials. Each number is one you choose to track.',
  },
  {
    question: 'How secure is my financial data?',
    answer:
      'Your browser derives an encryption key from your PIN and sends the key to the server for your unlocked session. The server encrypts and decrypts your financial records using AES-256-GCM; the database stores their encrypted payloads. Your PIN stays in your browser. This is not client-only or zero-knowledge encryption.',
  },
  {
    question: 'Can I get my data out?',
    answer:
      'From your profile, download a JSON export of your profile, snapshots, expenses, salary, tax reliefs, trades, dividends, and planner settings. Records are decrypted on the server during your unlocked session and the saved file is plaintext. Household data is not included.',
  },
  {
    question: 'Is this only for Singapore residents?',
    answer:
      'The tax and CPF calculations are tailored for Singapore, but asset tracking, the equity portfolio, and investment planning work for anyone.',
  },
  {
    question: 'How are tax reliefs calculated?',
    answer:
      'Fynfo uses your profile (birth year, NSman status, residency) to compute earned-income and NSman relief automatically. You can toggle additional reliefs — spouse, child, parent, SRS — on the salary page.',
  },
  {
    question: 'Which brokers are supported for fee calculation?',
    answer:
      'DBS Vickers and Moomoo, with automatic fee calculation for both SG and US markets. You can always override the fee manually.',
  },
];

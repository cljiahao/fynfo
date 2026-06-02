import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  PiggyBank,
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

export const TRUST_BADGES: string[] = [
  'Zero-knowledge',
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
      'Yes — Fynfo is completely free for personal use. No premium tiers, no hidden fees.',
  },
  {
    question: 'How secure is my financial data?',
    answer:
      'Your data is encrypted on your device with a key derived from a PIN only you know (AES-256-GCM). It is stored encrypted in the database — even we cannot read it. This is zero-knowledge by design.',
  },
  {
    question: 'Can I get my data out?',
    answer:
      'Any time. From your profile you can download a complete JSON backup of everything — snapshots, expenses, salary, tax reliefs, trades, and settings — decrypted on your own device.',
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

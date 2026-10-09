import type { ReliefDefinition } from './types';

const COMMON_TAX_BRACKETS = [
  { upTo: 20000, rate: 0 },
  { upTo: 30000, rate: 0.02 },
  { upTo: 40000, rate: 0.035 },
  { upTo: 80000, rate: 0.07 },
  { upTo: 120000, rate: 0.115 },
  { upTo: 160000, rate: 0.15 },
  { upTo: 200000, rate: 0.18 },
  { upTo: 240000, rate: 0.19 },
  { upTo: 280000, rate: 0.195 },
  { upTo: 320000, rate: 0.2 },
] as const;

// YA2024 onwards applies to income earned from calendar year2023.
export const TAX_BRACKETS = [
  ...COMMON_TAX_BRACKETS,
  { upTo: 500000, rate: 0.22 },
  { upTo: 1000000, rate: 0.23 },
  { upTo: Infinity, rate: 0.24 },
] as const;

export const HISTORICAL_TAX_BRACKETS = [
  ...COMMON_TAX_BRACKETS,
  { upTo: Infinity, rate: 0.22 },
] as const;

export const NON_RESIDENT_RATE = 0.15;
export const PERSONAL_RELIEF_CAP = 80000;

// CPF employee contribution rate
export const CPF_EMPLOYEE_RATE = 0.2;

// CPF monthly ordinary wage ceiling by year
export const CPF_MONTHLY_CEILING: Record<number, number> = {
  2023: 6300,
  2024: 6800,
  2025: 7400,
  2026: 8000,
};

// CPF annual wage ceiling by year
export const CPF_ANNUAL_CEILING: Record<number, number> = {
  2023: 102000,
  2024: 102000,
  2025: 102000,
  2026: 102000,
};

// Additional tax relief catalog
export const RELIEF_CATALOG: ReliefDefinition[] = [
  {
    key: 'spouse',
    label: 'Spouse Relief',
    defaultAmount: 2000,
    description: 'Spouse with income below SGD 4,000 in the previous year.',
  },
  {
    key: 'child',
    label: 'Qualifying Child Relief',
    defaultAmount: 4000,
    description:
      'SGD 4,000 per qualifying child (unmarried, under 16, or in full-time education).',
    maxCount: 10,
  },
  {
    key: 'parent',
    label: 'Parent Relief',
    defaultAmount: 9000,
    description:
      'For dependant parent/grandparent. Amount depends on living arrangement.',
    variants: [
      { value: 'staying', label: 'Staying with you', amount: 9000 },
      { value: 'not_staying', label: 'Not staying', amount: 5500 },
    ],
  },
  {
    key: 'course_fees',
    label: 'Course Fees Relief',
    defaultAmount: 5500,
    description:
      'Fees paid for approved courses, seminars, or conferences for yourself.',
  },
  {
    key: 'life_insurance',
    label: 'Life Insurance Relief',
    defaultAmount: 5000,
    description:
      'Premiums paid on life insurance policies for yourself or your wife.',
  },
  {
    key: 'cpf_top_up',
    label: 'CPF Cash Top-Up Relief',
    defaultAmount: 8000,
    description:
      'Voluntary cash top-ups to your own or family member Special/Retirement/MediSave Account.',
  },
  {
    key: 'srs',
    label: 'SRS Relief',
    defaultAmount: 15300,
    description:
      'Contributions to your Supplementary Retirement Scheme account (max SGD 15,300 for citizens/PRs).',
  },
];

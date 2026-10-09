'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGD } from '@/lib/utils/currency';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSalaryYtdStats } from '../hooks/use-salary-ytd-stats';
import { type TaxSummary } from '../lib/tax-cpf';
import type { SalaryData } from '../types';
import { TaxReliefsDialog } from './tax-reliefs-dialog';

export interface ReliefItem {
  label: string;
  amount: number;
}

interface SalarySummaryProps {
  records: SalaryData[];
}

function Row({
  label,
  value,
  variant = 'default',
  indent = false,
}: {
  label: string;
  value: string;
  variant?: 'default' | 'muted' | 'negative' | 'positive' | 'bold';
  indent?: boolean;
}) {
  const valueClass = {
    default: 'font-medium',
    muted: 'text-muted-foreground',
    negative: 'text-loss font-medium',
    positive: 'text-gain font-bold',
    bold: 'font-bold text-lg',
  }[variant];

  return (
    <div className="flex-between py-1">
      <span className={`${indent ? 'text-muted-foreground pl-3' : ''} text-sm`}>
        {label}
      </span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}

function SummaryColumn({
  title,
  subtitle,
  summary,
  reliefItems,
  onOpenReliefs,
}: {
  title: string;
  subtitle: string;
  summary: TaxSummary;
  reliefItems: ReliefItem[];
  onOpenReliefs: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-muted-foreground pb-1 text-xs font-semibold tracking-wide uppercase">
          Income
        </p>
        <Row
          label="Gross Annual"
          value={formatSGD(summary.grossAnnual)}
          variant="bold"
          indent
        />

        <Separator className="my-2" />

        <p className="text-muted-foreground pb-1 text-xs font-semibold tracking-wide uppercase">
          Deductions
        </p>
        <Row
          label="CPF (Employee 20%)"
          value={`-${formatSGD(summary.totalCpf)}`}
          variant="negative"
          indent
        />

        <Separator className="my-2" />

        <div className="flex items-center gap-2">
          <p className="text-muted-foreground pb-1 text-xs font-semibold tracking-wide uppercase">
            Tax
          </p>
          {!summary.isNonResident && (
            <button
              type="button"
              className="bg-muted hover:bg-primary hover:text-primary-foreground mb-1 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors"
              onClick={onOpenReliefs}
            >
              <Plus className="size-3" />
              Reliefs
            </button>
          )}
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="tax-reliefs" className="border-none">
            <AccordionTrigger className="p-0 hover:no-underline">
              <span className="text-muted-foreground text-xs">
                Relief breakdown
              </span>
            </AccordionTrigger>
            <AccordionContent className="!px-0 pt-1 pb-0">
              {summary.isNonResident ? (
                <Row
                  label="Non-resident employment: higher of 15% or resident rates"
                  value="No personal reliefs"
                  variant="muted"
                />
              ) : (
                <>
                  <Row
                    label="Earned Income Relief"
                    value={`-${formatSGD(summary.earnedIncomeRelief)}`}
                    variant="muted"
                  />
                  {summary.nsmanRelief > 0 && (
                    <Row
                      label="NSMan Relief"
                      value={`-${formatSGD(summary.nsmanRelief)}`}
                      variant="muted"
                    />
                  )}
                  {reliefItems.map((item) => (
                    <Row
                      key={item.label}
                      label={item.label}
                      value={`-${formatSGD(item.amount)}`}
                      variant="muted"
                    />
                  ))}
                  <Row
                    label="Requested reliefs (excluding CPF)"
                    value={`-${formatSGD(summary.taxReliefs)}`}
                    variant="muted"
                  />
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Row
          label="Chargeable Income"
          value={formatSGD(summary.chargeableIncome)}
          indent
        />
        <Row
          label="Tax Payable"
          value={formatSGD(summary.taxPayable)}
          variant="negative"
          indent
        />
        <Row
          label="Effective Rate"
          value={`${(summary.effectiveRate * 100).toFixed(2)}%`}
          variant="muted"
          indent
        />

        <Separator className="my-2" />

        <Row
          label="Net (after CPF + Tax)"
          value={formatSGD(summary.netAfterCpfAndTax)}
          variant="positive"
        />
        <Row
          label="Monthly Take-home"
          value={formatSGD(summary.netAfterCpfAndTax / 12)}
          variant="muted"
        />
      </CardContent>
    </Card>
  );
}

export function SalarySummary({ records }: SalarySummaryProps) {
  const [reliefDialogOpen, setReliefDialogOpen] = useState(false);
  const [reliefItems, setReliefItems] = useState<ReliefItem[]>([]);

  const additionalReliefsTotal = reliefItems.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  const {
    currentYear,
    currentYearRecords,
    monthsRecorded,
    estSummary,
    trueSummary,
    profileState,
    retryProfile,
  } = useSalaryYtdStats(records, additionalReliefsTotal);

  if (profileState !== 'ready') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tax and CPF estimates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            role={profileState === 'error' ? 'alert' : 'status'}
            className="text-muted-foreground text-sm"
          >
            {profileState === 'loading'
              ? 'Loading your tax profile…'
              : profileState === 'error'
                ? 'Couldn’t load your tax profile. Your income records are still available.'
                : 'Add your birth year and confirm tax residency in Profile before viewing these estimates.'}
          </p>
          {profileState === 'error' ? (
            <Button onClick={retryProfile}>Retry tax profile</Button>
          ) : profileState === 'incomplete' ? (
            <Button asChild>
              <Link href={PAGE_ROUTES.PROFILE}>Complete profile</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <SummaryColumn
          title="Estimated Annual"
          subtitle={
            monthsRecorded > 0
              ? `Extrapolated from ${monthsRecorded} month(s) of ${currentYear} data`
              : 'No salary data for this year'
          }
          summary={estSummary}
          reliefItems={reliefItems}
          onOpenReliefs={() => setReliefDialogOpen(true)}
        />
        <SummaryColumn
          title={`True Annual (${currentYear})`}
          subtitle={`Based on ${currentYearRecords.length} month(s) of actual records`}
          summary={trueSummary}
          reliefItems={reliefItems}
          onOpenReliefs={() => setReliefDialogOpen(true)}
        />
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        Estimates use a fixed 20% employee CPF model, not age or PR-stage rates.
        Resident personal reliefs, including CPF, are capped at SGD 80,000. Tax
        is before rebates, eligible deductions and special exemptions.
      </p>

      <TaxReliefsDialog
        open={reliefDialogOpen}
        onOpenChange={setReliefDialogOpen}
        earnedIncomeRelief={estSummary.earnedIncomeRelief}
        nsmanRelief={estSummary.nsmanRelief}
        isNonResident={estSummary.isNonResident}
        onConfirm={setReliefItems}
      />
    </>
  );
}

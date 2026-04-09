'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useProfile } from '@/features/profile/hooks/use-profile';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  calculateTaxSummary,
  type TaxProfileContext,
  type TaxSummary,
} from '../lib/tax-cpf';
import type { SalaryData } from '../types';
import { TaxReliefsDialog } from './tax-reliefs-dialog';

export interface ReliefItem {
  label: string;
  amount: number;
}

interface SalarySummaryProps {
  records: SalaryData[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
    negative: 'text-red-500 font-medium',
    positive: 'text-emerald-600 font-bold',
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
        {/* Income */}
        <p className="text-muted-foreground pb-1 text-xs font-semibold tracking-wide uppercase">
          Income
        </p>
        <Row
          label="Gross Annual"
          value={formatCurrency(summary.grossAnnual)}
          variant="bold"
          indent
        />

        <Separator className="my-2" />

        {/* Deductions (CPF only) */}
        <p className="text-muted-foreground pb-1 text-xs font-semibold tracking-wide uppercase">
          Deductions
        </p>
        <Row
          label="CPF (Employee 20%)"
          value={`-${formatCurrency(summary.totalCpf)}`}
          variant="negative"
          indent
        />

        <Separator className="my-2" />

        {/* Tax */}
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
                  label="Non-resident (flat 22%)"
                  value="No personal reliefs"
                  variant="muted"
                />
              ) : (
                <>
                  <Row
                    label="Earned Income Relief"
                    value={`-${formatCurrency(summary.earnedIncomeRelief)}`}
                    variant="muted"
                  />
                  {summary.nsmanRelief > 0 && (
                    <Row
                      label="NSMan Relief"
                      value={`-${formatCurrency(summary.nsmanRelief)}`}
                      variant="muted"
                    />
                  )}
                  {reliefItems.map((item) => (
                    <Row
                      key={item.label}
                      label={item.label}
                      value={`-${formatCurrency(item.amount)}`}
                      variant="muted"
                    />
                  ))}
                  <Row
                    label="Total Tax Reliefs"
                    value={`-${formatCurrency(summary.taxReliefs)}`}
                    variant="muted"
                  />
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Row
          label="Chargeable Income"
          value={formatCurrency(summary.chargeableIncome)}
          indent
        />
        <Row
          label="Tax Payable"
          value={formatCurrency(summary.taxPayable)}
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

        {/* Net */}
        <Row
          label="Net (after CPF + Tax)"
          value={formatCurrency(summary.netAfterCpfAndTax)}
          variant="positive"
        />
        <Row
          label="Monthly Take-home"
          value={formatCurrency(summary.netAfterCpfAndTax / 12)}
          variant="muted"
        />
      </CardContent>
    </Card>
  );
}

export function SalarySummary({ records }: SalarySummaryProps) {
  const { data: profile } = useProfile();
  const currentYear = new Date().getFullYear();
  const [reliefDialogOpen, setReliefDialogOpen] = useState(false);
  const [reliefItems, setReliefItems] = useState<ReliefItem[]>([]);

  const additionalReliefsTotal = reliefItems.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  const taxProfile: TaxProfileContext = {
    birthYear: profile?.birthYear ?? null,
    isNsman: profile?.isNsman ?? true,
    residencyStatus: profile?.residencyStatus ?? 'resident',
  };

  const currentYearRecords = records.filter((r) =>
    r.id.startsWith(`${currentYear}-`)
  );
  const monthsRecorded = currentYearRecords.length;

  const ytdSalary = currentYearRecords.reduce((sum, r) => sum + r.salary, 0);
  const ytdBonus = currentYearRecords.reduce((sum, r) => sum + r.bonus, 0);
  const estAnnualSalary =
    monthsRecorded > 0 ? (ytdSalary / monthsRecorded) * 12 : 0;
  const estAnnualBonus =
    monthsRecorded > 0 ? (ytdBonus / monthsRecorded) * 12 : 0;
  const estSummary = calculateTaxSummary(
    estAnnualSalary,
    estAnnualBonus,
    currentYear,
    taxProfile,
    additionalReliefsTotal
  );

  const trueSummary = calculateTaxSummary(
    ytdSalary,
    ytdBonus,
    currentYear,
    taxProfile,
    additionalReliefsTotal
  );

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

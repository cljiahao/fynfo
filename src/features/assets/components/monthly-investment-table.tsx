'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { formatSGD } from '@/lib/utils/currency';
import { AlertCircle } from 'lucide-react';

type RatioKey = 'rsp' | 'us' | 'sg';

interface MonthlyInvestmentTableProps {
  investmentAmount: number;
  ratios: Record<RatioKey, number>;
  rspMonthly: number;
  sgMonthly: number;
  usMonthly: number;
  totalRatio: number;
  updateRatio: (key: RatioKey, value: number) => void;
}

// Editable monthly-investment ratio table (RSP / SG / US). Presentational;
// ratio state lives in the InvestmentBreakdown container.
export function MonthlyInvestmentTable({
  investmentAmount,
  ratios,
  rspMonthly,
  sgMonthly,
  usMonthly,
  totalRatio,
  updateRatio,
}: MonthlyInvestmentTableProps) {
  const rows = [
    { label: 'RSP', key: 'rsp' as const, monthly: rspMonthly },
    { label: 'SG Market', key: 'sg' as const, monthly: sgMonthly },
    { label: 'US Market', key: 'us' as const, monthly: usMonthly },
  ];

  return (
    <div className="overflow-x-auto">
      <Accordion type="single" collapsible>
        <AccordionItem value="monthly" className="border-none">
          <AccordionTrigger className="text-muted-foreground p-0 text-xs font-medium">
            Monthly Investment — {formatSGD(investmentAmount)}
          </AccordionTrigger>
          <AccordionContent className="px-0 pt-2 pb-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Category</th>
                  <th className="py-2 text-center font-medium">Ratio</th>
                  <th className="py-2 text-right font-medium">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="py-2 font-medium">{row.label}</td>
                    <td className="py-2 text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        className="mx-auto h-7 w-16 text-center text-xs"
                        value={ratios[row.key] || ''}
                        placeholder="0"
                        onChange={(e) =>
                          updateRatio(row.key, Number(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatSGD(row.monthly)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td className="py-2 font-semibold">Total</td>
                  <td
                    className={`py-2 text-center font-semibold tabular-nums ${totalRatio !== 100 ? 'text-loss' : ''}`}
                  >
                    {totalRatio}%
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {formatSGD(investmentAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {totalRatio !== 100 && (
              <p className="text-loss mt-1 flex items-center gap-1 text-xs">
                <AlertCircle className="size-3" />
                Must sum to 100%
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

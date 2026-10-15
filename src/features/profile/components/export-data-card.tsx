'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { useExportData } from '../hooks/use-export-data';
import { ExportReview } from './export-review';

export function ExportDataCard() {
  const { hidden } = useAmountVisibility();
  const { exportData, isExporting } = useExportData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
        <CardDescription>
          Download your personal records as JSON. The file contains decrypted
          information; keep it private. Household data is not included.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          This export cannot be restored in Fynfo. Edits made during export may
          appear inconsistently; avoid changing records until it finishes.
        </p>
        <Button
          onClick={exportData}
          disabled={hidden || isExporting}
          variant="outline"
        >
          {isExporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          {isExporting ? 'Exporting...' : 'Export my data'}
        </Button>
        <details className="text-muted-foreground text-sm">
          <summary className="text-foreground focus-visible:outline-ring cursor-pointer rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
            What’s included
          </summary>
          <p className="mt-2 leading-relaxed">
            Profile, snapshots, expenses, salary, tax reliefs, trades,
            dividends, planner settings, saved planning scenarios, merchant
            rules, and recurring templates with occurrence history. Records are
            decrypted during your unlocked session.
          </p>
        </details>
        <details className="text-sm">
          <summary className="focus-visible:outline-ring cursor-pointer rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
            Review an existing export
          </summary>
          <div className="mt-4">
            <ExportReview />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

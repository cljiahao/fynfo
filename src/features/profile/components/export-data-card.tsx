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
          Download a JSON export of your profile, snapshots, expenses, salary,
          tax reliefs, trades, dividends, planner settings, saved planning
          scenarios, and merchant rules. The server decrypts these records
          during your unlocked session; the downloaded file contains plaintext.
          Household data is not included.
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
        <ExportReview />
      </CardContent>
    </Card>
  );
}

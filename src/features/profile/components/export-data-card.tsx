'use client';

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

export function ExportDataCard() {
  const { exportData, isExporting } = useExportData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
        <CardDescription>
          Download a complete JSON backup of your vault — snapshots, expenses,
          salary, tax reliefs, trades, and planner settings. Decrypted on your
          device; nothing leaves the browser except the file you save.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={exportData} disabled={isExporting} variant="outline">
          {isExporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          {isExporting ? 'Exporting...' : 'Export my data'}
        </Button>
      </CardContent>
    </Card>
  );
}

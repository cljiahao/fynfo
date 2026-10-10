'use client';

import { getScenarios } from '@/features/assets';
import { getPlannerSettings } from '@/features/assets/actions/planner-actions';
import { getSnapshots } from '@/features/assets/actions/snapshot-actions';
import { getDividends } from '@/features/equity/actions/dividend-actions';
import { getTrades } from '@/features/equity/actions/equity-actions';
import { getExpenses } from '@/features/expenses/actions/expense-actions';
import { getAllTaxReliefs } from '@/features/salary/actions/relief-actions';
import { getSalaryRecords } from '@/features/salary/actions/salary-actions';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getProfile } from '../actions/profile-actions';
import {
  buildExportEnvelope,
  exportFileName,
  serializeExport,
} from '../lib/export-data';

function downloadJson(content: string, filename: string): void {
  const a = document.createElement('a');
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' })
  );
  try {
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
  } finally {
    a.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * Downloads a decrypted personal-vault export, not a proven recovery backup.
 * A failed domain read prevents download; cross-domain reads are not atomic.
 */
export function useExportData() {
  const [isExporting, setIsExporting] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const exportData = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsExporting(true);
    try {
      const [
        profile,
        snapshots,
        expenses,
        salary,
        taxReliefs,
        trades,
        dividends,
        plannerSettings,
        scenarios,
      ] = await Promise.all([
        getProfile(),
        getSnapshots(),
        getExpenses(),
        getSalaryRecords(),
        getAllTaxReliefs(),
        getTrades(),
        getDividends(),
        getPlannerSettings(),
        getScenarios(),
      ]);

      if (!mounted.current) return;
      const envelope = buildExportEnvelope(
        {
          profile,
          snapshots: snapshots.map(({ id, entries }) => ({ id, entries })),
          expenses,
          salary,
          taxReliefs,
          trades,
          dividends,
          plannerSettings,
          scenarios,
        },
        new Date().toISOString()
      );

      downloadJson(serializeExport(envelope), exportFileName(new Date()));
      toast.success('Data exported');
    } catch {
      if (mounted.current)
        toast.error('Export failed. Make sure your vault is unlocked.');
    } finally {
      pending.current = false;
      if (mounted.current) setIsExporting(false);
    }
  };

  return { exportData, isExporting };
}

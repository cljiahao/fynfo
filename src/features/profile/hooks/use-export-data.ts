'use client';

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
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Gathers every domain (decrypted server-side via the session DEK) and saves a
 * single versioned JSON backup to the user's device. No partial file on error.
 */
export function useExportData() {
  const [isExporting, setIsExporting] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const exportData = async () => {
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
      ] = await Promise.all([
        getProfile(),
        getSnapshots(),
        getExpenses(),
        getSalaryRecords(),
        getAllTaxReliefs(),
        getTrades(),
        getDividends(),
        getPlannerSettings(),
      ]);

      if (!mounted.current) return;
      const envelope = buildExportEnvelope(
        {
          profile,
          snapshots,
          expenses,
          salary,
          taxReliefs,
          trades,
          dividends,
          plannerSettings,
        },
        new Date().toISOString()
      );

      downloadJson(serializeExport(envelope), exportFileName(new Date()));
      toast.success('Data exported');
    } catch {
      if (mounted.current)
        toast.error('Export failed. Make sure your vault is unlocked.');
    } finally {
      if (mounted.current) setIsExporting(false);
    }
  };

  return { exportData, isExporting };
}

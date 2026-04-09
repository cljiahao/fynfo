'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { processStatement } from '../actions/statement-actions';
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS } from '../constants';
import { useUpsertExpense } from '../hooks/use-expenses';
import type { ParsedExpenseRow } from '../lib/statement-parser';
import type { ExpenseData, ExpenseType } from '../types';

interface StatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const generateId = () =>
  `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function rowToExpense(row: ParsedExpenseRow): ExpenseData {
  return {
    id: generateId(),
    date: row.date,
    type: row.type,
    item: row.item,
    info: row.info,
    amount: row.amount,
    splitType: 'self',
    splits: [],
  };
}

export function StatementDialog({ open, onOpenChange }: StatementDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<ExpenseData[]>([]);
  const [usedAi, setUsedAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upsert = useUpsertExpense();
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setRows([]);
    setUsedAi(false);
    setError(null);
    setFileName(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setRows([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await processStatement(formData);
      if (result.error) {
        setError(result.error);
      }
      if (result.rows.length > 0) {
        setRows(result.rows.map(rowToExpense));
        setUsedAi(result.usedAi);
      }
    } catch {
      setError('Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateRow = (index: number, patch: Partial<ExpenseData>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    const valid = rows.filter((r) => r.amount > 0 && r.date);
    if (valid.length === 0) {
      toast.error('No valid rows to save');
      return;
    }

    setIsSaving(true);
    try {
      for (const row of valid) {
        await upsert.mutateAsync(row);
      }
      toast.success(
        `${valid.length} expense${valid.length > 1 ? 's' : ''} saved`
      );
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save expenses');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload a PDF or CSV bank/credit card statement. Transactions will be
            extracted and shown below for review before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div
            className="border-input hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="text-muted-foreground size-8" />
            <div>
              <p className="text-sm font-medium">
                {fileName ?? 'Click to upload or drag and drop'}
              </p>
              <p className="text-muted-foreground text-xs">
                PDF or CSV — DBS, UOB, OCBC, credit card statements
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Processing state */}
          {isProcessing && (
            <div className="flex-center gap-2 py-6">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-muted-foreground text-sm">
                Processing statement...
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* AI badge */}
          {usedAi && rows.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-violet-600">
              <Sparkles className="size-3.5" />
              Extracted using local AI — please review before saving
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[750px] table-fixed">
                  <colgroup>
                    <col className="w-[110px]" />
                    <col className="w-[140px]" />
                    <col className="w-[140px]" />
                    <col />
                    <col className="w-[100px]" />
                    <col className="w-[50px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted/50 border-b text-xs font-semibold">
                      <th className="px-2 py-2 text-center">Date</th>
                      <th className="px-2 py-2 text-center">Type</th>
                      <th className="px-2 py-2 text-center">Item</th>
                      <th className="px-2 py-2 text-center">Info</th>
                      <th className="px-2 py-2 text-center">Amount</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.id}
                        className="hover:bg-muted/40 border-b text-sm transition-colors"
                      >
                        <td className="px-2 py-1.5">
                          <Input
                            type="date"
                            value={row.date}
                            onChange={(e) =>
                              updateRow(i, { date: e.target.value })
                            }
                            className="h-8 w-full text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
                            value={row.type}
                            onValueChange={(v) =>
                              updateRow(i, { type: v as ExpenseType })
                            }
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EXPENSE_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {EXPENSE_TYPE_LABELS[t]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={row.item}
                            onChange={(e) =>
                              updateRow(i, { item: e.target.value })
                            }
                            className="h-8 w-full text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={row.info}
                            onChange={(e) =>
                              updateRow(i, { info: e.target.value })
                            }
                            className="h-8 w-full text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount || ''}
                            onChange={(e) =>
                              updateRow(i, {
                                amount: Number(e.target.value) || 0,
                              })
                            }
                            className="h-8 w-full text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeRow(i)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary + Save */}
              <div className="flex-between">
                <p className="text-muted-foreground text-xs">
                  {rows.length} transaction{rows.length > 1 ? 's' : ''} — Total:{' '}
                  {new Intl.NumberFormat('en-SG', {
                    style: 'currency',
                    currency: 'SGD',
                  }).format(rows.reduce((s, r) => s + r.amount, 0))}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset}>
                    Clear
                  </Button>
                  <Button onClick={handleSaveAll} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    Save {rows.length} Expense{rows.length > 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

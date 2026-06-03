'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { formatSGD } from '@/lib/utils/currency';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ExpenseSplitData } from '../types';

interface SplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  initialSplits: ExpenseSplitData[];
  peopleSuggestions: string[];
  onConfirm: (splits: ExpenseSplitData[]) => void;
}

export function SplitDialog({
  open,
  onOpenChange,
  totalAmount,
  initialSplits,
  peopleSuggestions,
  onConfirm,
}: SplitDialogProps) {
  const [splits, setSplits] = useState<ExpenseSplitData[]>(initialSplits);
  const [newName, setNewName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  // paidFor: true = you fronted everything, others owe their full share (your share = $0)
  // false (default) = you're splitting with others (your share = total - others)
  const [paidFor, setPaidFor] = useState(false);

  // useState seeds only on mount; the dialog instance is reused across rows, so
  // resync the working copy to initialSplits on each closed -> open transition.
  // Without this, reopening shows stale splits from a previously edited row.
  // Render-phase adjustment (React's "you might not need an effect" pattern)
  // keeps the reset inside this dialog and avoids a cascading-render effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSplits(initialSplits);
      setNewName('');
      setShowSuggestions(false);
      setPaidFor(false);
    }
  }

  const existingNames = splits.map((s) => s.person);
  const filtered = peopleSuggestions.filter(
    (s) =>
      s.toLowerCase().includes(newName.toLowerCase()) &&
      !existingNames.includes(s)
  );

  const totalPeople = paidFor ? splits.length : splits.length + 1;
  const evenShare =
    totalPeople > 0 && totalAmount > 0 ? totalAmount / totalPeople : 0;
  const roundedShare = Math.round(evenShare * 100) / 100;

  const computeEvenSplitsFor = (
    list: ExpenseSplitData[],
    isPaidFor: boolean
  ) => {
    const count = isPaidFor ? list.length : list.length + 1;
    const perPerson =
      totalAmount > 0 && count > 0
        ? Math.round((totalAmount / count) * 100) / 100
        : 0;
    return list.map((s) => ({ ...s, amount: perPerson }));
  };

  const computeEvenSplits = (list: ExpenseSplitData[]) =>
    computeEvenSplitsFor(list, paidFor);

  const addPerson = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || existingNames.includes(trimmed)) return;

    const newSplits = [
      ...splits,
      { person: trimmed, amount: 0, settled: false },
    ];
    setSplits(computeEvenSplits(newSplits));
    setNewName('');
    setShowSuggestions(false);
  };

  const removePerson = (name: string) => {
    const newSplits = splits.filter((s) => s.person !== name);
    if (newSplits.length === 0) {
      setSplits([]);
      return;
    }
    setSplits(computeEvenSplits(newSplits));
  };

  const updateSplitAmount = (person: string, amount: number) => {
    setSplits((prev) =>
      prev.map((s) => (s.person === person ? { ...s, amount } : s))
    );
  };

  const toggleSettled = (person: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.person === person ? { ...s, settled: !s.settled } : s))
    );
  };

  const resetToEven = () => {
    setSplits((prev) => computeEvenSplits(prev));
  };

  const othersTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const yourShare = paidFor ? 0 : totalAmount - othersTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-8 max-h-[calc(100vh-4rem)] translate-y-0 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split Expense</DialogTitle>
          <DialogDescription>Total: {formatSGD(totalAmount)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 rounded-lg border p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setPaidFor(false);
                setSplits((prev) => computeEvenSplitsFor(prev, false));
              }}
              className={`rounded-md px-3 py-1.5 transition-colors ${!paidFor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Splitting with
            </button>
            <button
              type="button"
              onClick={() => {
                setPaidFor(true);
                setSplits((prev) => computeEvenSplitsFor(prev, true));
              }}
              className={`rounded-md px-3 py-1.5 transition-colors ${paidFor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Paid for
            </button>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            {paidFor
              ? 'You fronted the full amount — others owe you their share, your cut is $0.'
              : "You're in on the bill — the cost is divided between you and the others."}
          </p>

          {/* Add person input */}
          <div className="relative">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    e.preventDefault();
                    addPerson(newName);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Add person's name..."
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => addPerson(newName)}
                disabled={!newName.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {showSuggestions && filtered.length > 0 && newName.length > 0 && (
              <div className="bg-popover absolute top-full z-10 mt-1 w-full rounded-md border py-1 shadow-md">
                {filtered.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="hover:bg-muted w-full px-3 py-1.5 text-left text-sm"
                    onMouseDown={() => addPerson(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Split table */}
          {splits.length > 0 && (
            <>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b text-xs font-medium">
                      <th className="px-3 py-2 text-left">Person</th>
                      <th className="w-[120px] px-3 py-2 text-right">Owes</th>
                      <th className="w-[60px] px-3 py-2 text-center">
                        Settled
                      </th>
                      <th className="w-[40px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {splits.map((s) => (
                      <tr key={s.person} className="border-b last:border-0">
                        <td className="px-3 py-1.5 font-medium">{s.person}</td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={s.amount || ''}
                            onChange={(e) =>
                              updateSplitAmount(
                                s.person,
                                Number(e.target.value) || 0
                              )
                            }
                            className="h-7 w-full text-right text-xs"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <Checkbox
                            checked={s.settled}
                            onCheckedChange={() => toggleSettled(s.person)}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-red-500 hover:text-red-600"
                            onClick={() => removePerson(s.person)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToEven}
                  className="text-xs"
                >
                  Split evenly
                </Button>
                <span className="text-muted-foreground text-xs">
                  {formatSGD(totalAmount)} ÷ {totalPeople}{' '}
                  {totalPeople === 1 ? 'person' : 'people'} ={' '}
                  {formatSGD(roundedShare)} each
                </span>
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex-between">
                  <span className="text-muted-foreground">They owe you</span>
                  <span className="font-medium">{formatSGD(othersTotal)}</span>
                </div>
                {!paidFor && (
                  <div className="flex-between">
                    <span className="font-medium">Your share</span>
                    <span className="font-semibold">
                      {formatSGD(yourShare)}
                    </span>
                  </div>
                )}
                {paidFor && (
                  <div className="flex-between">
                    <span className="text-muted-foreground">Your share</span>
                    <span className="text-muted-foreground">
                      $0 — you get it all back
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {splits.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Add people above to split this expense with.
            </p>
          )}

          {/* Confirm */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm(splits);
                onOpenChange(false);
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

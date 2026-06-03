'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PlannerInputsProps {
  salary: number;
  expenses: number;
  emergencyMonths: number;
  warChestMonths: number;
  avgExpenses: number;
  setSalary: (v: number) => void;
  setExpenses: (v: number) => void;
  setEmergencyMonths: (v: number) => void;
  setWarChestMonths: (v: number) => void;
}

// The four planner number inputs. Presentational; state lives in the
// SalaryPlanner container.
export function PlannerInputs({
  salary,
  expenses,
  emergencyMonths,
  warChestMonths,
  avgExpenses,
  setSalary,
  setExpenses,
  setEmergencyMonths,
  setWarChestMonths,
}: PlannerInputsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="space-y-1">
        <Label className="text-xs">Gross Salary</Label>
        <Input
          type="number"
          min="0"
          placeholder="0"
          className="h-8 text-sm"
          value={salary || ''}
          onChange={(e) => setSalary(Number(e.target.value) || 0)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">
          {avgExpenses > 0 ? 'Avg. Expenses' : 'Est. Expenses'}
        </Label>
        <Input
          type="number"
          min="0"
          placeholder="0"
          className="h-8 text-sm"
          value={expenses || ''}
          onChange={(e) => setExpenses(Number(e.target.value) || 0)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Emergency Fund (months)</Label>
        <Input
          type="number"
          min="1"
          placeholder="3"
          className="h-8 text-sm"
          value={emergencyMonths || ''}
          onChange={(e) => setEmergencyMonths(Number(e.target.value) || 0)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">War Chest (months)</Label>
        <Input
          type="number"
          min="1"
          placeholder="9"
          className="h-8 text-sm"
          value={warChestMonths || ''}
          onChange={(e) => setWarChestMonths(Number(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

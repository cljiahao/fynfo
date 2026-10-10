'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PlannerInputsProps {
  idPrefix?: string;
  allowZeroFractionalReserves?: boolean;
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

// Presentational inputs; the caller owns hypothetical state.
export function PlannerInputs({
  idPrefix = 'planner',
  allowZeroFractionalReserves = false,
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-salary`} className="text-xs">
            Gross Salary
          </Label>
          <Input
            id={`${idPrefix}-salary`}
            type="number"
            min="0"
            placeholder="0"
            className="h-8 text-sm"
            value={salary || ''}
            onChange={(e) => setSalary(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-expenses`} className="text-xs">
            {avgExpenses > 0 ? 'Avg. Expenses' : 'Est. Expenses'}
          </Label>
          <Input
            id={`${idPrefix}-expenses`}
            type="number"
            min="0"
            placeholder="0"
            className="h-8 text-sm"
            value={expenses || ''}
            onChange={(e) => setExpenses(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <Accordion type="single" collapsible>
        <AccordionItem value="reserves">
          <AccordionTrigger>Adjust reserves</AccordionTrigger>
          <p className="text-muted-foreground pb-3 text-xs">
            Emergency fund: {emergencyMonths} months · War chest:{' '}
            {warChestMonths} months
          </p>
          <AccordionContent>
            <p className="text-muted-foreground mb-3 text-xs">
              Choose how many months of expenses to set aside. These settings
              change your allocation estimate.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-emergency`} className="text-xs">
                  Emergency Fund (months)
                </Label>
                <Input
                  id={`${idPrefix}-emergency`}
                  type="number"
                  min={allowZeroFractionalReserves ? 0 : 1}
                  step={allowZeroFractionalReserves ? 'any' : 1}
                  placeholder="3"
                  className="h-8 text-sm"
                  value={
                    allowZeroFractionalReserves
                      ? emergencyMonths
                      : emergencyMonths || ''
                  }
                  onChange={(e) =>
                    setEmergencyMonths(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-war-chest`} className="text-xs">
                  War Chest (months)
                </Label>
                <Input
                  id={`${idPrefix}-war-chest`}
                  type="number"
                  min={allowZeroFractionalReserves ? 0 : 1}
                  step={allowZeroFractionalReserves ? 'any' : 1}
                  placeholder="9"
                  className="h-8 text-sm"
                  value={
                    allowZeroFractionalReserves
                      ? warChestMonths
                      : warChestMonths || ''
                  }
                  onChange={(e) =>
                    setWarChestMonths(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

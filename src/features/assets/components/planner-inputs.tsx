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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="planner-salary" className="text-xs">
            Gross Salary
          </Label>
          <Input
            id="planner-salary"
            type="number"
            min="0"
            placeholder="0"
            className="h-8 text-sm"
            value={salary || ''}
            onChange={(e) => setSalary(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="planner-expenses" className="text-xs">
            {avgExpenses > 0 ? 'Avg. Expenses' : 'Est. Expenses'}
          </Label>
          <Input
            id="planner-expenses"
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
                <Label htmlFor="planner-emergency" className="text-xs">
                  Emergency Fund (months)
                </Label>
                <Input
                  id="planner-emergency"
                  type="number"
                  min="1"
                  placeholder="3"
                  className="h-8 text-sm"
                  value={emergencyMonths || ''}
                  onChange={(e) =>
                    setEmergencyMonths(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="planner-war-chest" className="text-xs">
                  War Chest (months)
                </Label>
                <Input
                  id="planner-war-chest"
                  type="number"
                  min="1"
                  placeholder="9"
                  className="h-8 text-sm"
                  value={warChestMonths || ''}
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

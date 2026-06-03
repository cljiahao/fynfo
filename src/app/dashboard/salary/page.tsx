'use client';

import { Button } from '@/components/ui/button';
import {
  SalaryChart,
  SalaryFormDialog,
  SalarySummary,
  SalaryTable,
  useSalaryRecords,
} from '@/features/salary';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { SalarySkeleton } from './salary-skeleton';

export default function SalaryPage() {
  const { data: records, isLoading } = useSalaryRecords();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();

  if (isLoading) return <SalarySkeleton />;

  function handleAdd() {
    setEditId(undefined);
    setFormOpen(true);
  }

  function handleEdit(id: string) {
    setEditId(id);
    setFormOpen(true);
  }

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div className="flex-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salary</h1>
          <p className="text-muted-foreground mt-1">
            Track your salary growth, tax, and CPF contributions
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 size-4" />
          Add Record
        </Button>
      </div>

      <SalarySummary records={records ?? []} />

      <SalaryChart records={records ?? []} />

      <SalaryTable onEdit={handleEdit} />

      <SalaryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editId={editId}
      />
    </div>
  );
}

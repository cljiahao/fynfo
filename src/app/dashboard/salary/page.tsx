'use client';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/widgets';
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
      <PageHeader
        title="Salary"
        description="Track your salary growth, tax, and CPF contributions"
        action={
          <Button onClick={handleAdd}>
            <Plus className="mr-2 size-4" />
            Add Record
          </Button>
        }
      />

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

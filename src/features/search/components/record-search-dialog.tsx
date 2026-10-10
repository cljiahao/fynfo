'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { loadSearchTask } from '../lib/load-search-task';
import type { RecordSearchTaskProps } from '../types';

export function RecordSearch() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search records"
          title="Search records"
        >
          <Search className="size-4" />
        </Button>
      </DialogTrigger>
      {open && <SearchShell onSelect={() => setOpen(false)} />}
    </Dialog>
  );
}
function SearchShell({ onSelect }: RecordSearchTaskProps) {
  const [Task, setTask] = useState<ComponentType<RecordSearchTaskProps> | null>(
    null
  );
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadSearchTask()
      .then((module) => {
        if (active) setTask(() => module.RecordSearchTask);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Search records</DialogTitle>
        <DialogDescription>
          Search loaded personal histories. Household records are excluded.
        </DialogDescription>
      </DialogHeader>
      {Task ? (
        <Task onSelect={onSelect} />
      ) : failed ? (
        <div role="alert" className="space-y-2">
          <p>Couldn&apos;t open record search.</p>
          <Button
            variant="outline"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry search
          </Button>
        </div>
      ) : (
        <p role="status" className="text-muted-foreground text-sm">
          Loading record search…
        </p>
      )}
    </DialogContent>
  );
}

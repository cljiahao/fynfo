'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { Plane, Plus, Trash2, X } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  useAddSpending,
  useCreateSpace,
  useDeleteSpace,
  useDeleteSpending,
} from '../hooks/use-household';
import { inMonth } from '../lib/shared-spending';
import type { HouseholdSpace, SharedSpendingEntry } from '../types';
import { SpendingSummary } from './spending-summary';

const today = () => format(new Date(), 'yyyy-MM-dd');
const SELECT_CLASS =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50';

export function SharedSpending({ spaces }: { spaces: HouseholdSpace[] }) {
  const { hidden, canReveal } = useAmountVisibility();
  const createSpace = useCreateSpace();
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const ongoing = spaces.filter((space) => space.kind === 'ongoing');
  const trips = spaces.filter((space) => space.kind === 'trip');

  if (ongoing.length === 0 && trips.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium">Track shared spending</p>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            Log groceries, bills and trips you both pay for. See the combined
            total and who owes whom.
          </p>
          <Button
            disabled={hidden || createSpace.isPending}
            onClick={() => {
              if (canReveal())
                createSpace.mutate(
                  { kind: 'ongoing', name: 'Household' },
                  { onError: () => toast.error('Could not start tracking') }
                );
            }}
          >
            Start shared spending
          </Button>
        </CardContent>
      </Card>
    );
  }

  const monthEntries = ongoing
    .flatMap((space) => space.entries)
    .filter((entry) => inMonth(entry.date, month));

  return (
    <div className="space-y-6">
      <QuickAdd spaces={spaces} />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Household spending</h3>
            <Input
              aria-label="Spending month"
              type="month"
              className="w-40"
              value={month}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
            />
          </div>
          <SpendingSummary
            entries={monthEntries}
            emptyLabel="Nothing shared this month yet."
          />
          <EntryList entries={monthEntries} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Trips</h3>
        </div>
        <NewTripForm />
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}

function QuickAdd({ spaces }: { spaces: HouseholdSpace[] }) {
  const { hidden, canReveal } = useAmountVisibility();
  const fieldId = useId();
  const addSpending = useAddSpending();
  const amountRef = useRef<HTMLInputElement>(null);
  const ordered = [
    ...spaces.filter((space) => space.kind === 'ongoing'),
    ...spaces.filter((space) => space.kind === 'trip').reverse(),
  ];
  const [spaceId, setSpaceId] = useState(ordered[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const categories = [
    ...new Set(spaces.flatMap((space) => space.entries.map((e) => e.category))),
  ].sort();
  const activeSpaceId = ordered.some((space) => space.id === spaceId)
    ? spaceId
    : (ordered[0]?.id ?? '');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const value = parseFloat(amount);
    if (!activeSpaceId || !category.trim() || !value || value <= 0 || !date) {
      toast.error('A category, amount and date are required');
      return;
    }
    addSpending.mutate(
      {
        spaceId: activeSpaceId,
        date,
        category: category.trim(),
        amount: value,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          // Keep space, date and category for the next entry; most shared
          // spending is logged in bursts of the same kind.
          setAmount('');
          setNote('');
          amountRef.current?.focus();
        },
        onError: () => toast.error('Could not add the spending'),
      }
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form
          onSubmit={submit}
          className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_7rem_auto]"
        >
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-space`} className="text-xs">
              For
            </Label>
            <select
              id={`${fieldId}-space`}
              className={SELECT_CLASS}
              disabled={hidden}
              value={activeSpaceId}
              onChange={(event) => setSpaceId(event.target.value)}
            >
              {ordered.map((space) => (
                <option key={space.id} value={space.id}>
                  {hidden ? 'Hidden' : space.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-category`} className="text-xs">
              Category
            </Label>
            <Input
              id={`${fieldId}-category`}
              list={`${fieldId}-categories`}
              placeholder="e.g. Groceries"
              maxLength={40}
              disabled={hidden}
              value={hidden ? '' : category}
              onChange={(event) => {
                if (canReveal()) setCategory(event.target.value);
              }}
            />
            <datalist id={`${fieldId}-categories`}>
              {!hidden &&
                categories.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-note`} className="text-xs">
              Note
            </Label>
            <Input
              id={`${fieldId}-note`}
              placeholder="Optional"
              maxLength={200}
              disabled={hidden}
              value={hidden ? '' : note}
              onChange={(event) => {
                if (canReveal()) setNote(event.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-amount`} className="text-xs">
              Amount (SGD)
            </Label>
            <Input
              id={`${fieldId}-amount`}
              ref={amountRef}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="text-right tabular-nums"
              disabled={hidden}
              value={hidden ? '' : amount}
              onChange={(event) => {
                if (canReveal()) setAmount(event.target.value);
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Input
              aria-label="Spending date"
              type="date"
              className="w-36"
              disabled={hidden}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Button type="submit" disabled={hidden || addSpending.isPending}>
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EntryList({ entries }: { entries: SharedSpendingEntry[] }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const deleteSpending = useDeleteSpending();
  if (entries.length === 0) return null;
  return (
    <ul className="divide-y border-t text-sm">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-center justify-between gap-2 py-1.5"
        >
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground tabular-nums">
              {format(new Date(entry.date), 'dd MMM')}
            </span>{' '}
            {mask(entry.category)}
            {entry.note && (
              <span className="text-muted-foreground">
                {' '}
                · {mask(entry.note)}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {entry.isSelf ? 'You' : 'Partner'}
            </span>
            <span className="tabular-nums">
              {mask(formatSGD(entry.amount))}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive disabled:opacity-50"
              disabled={hidden || deleteSpending.isPending}
              aria-label={`Delete ${entry.date} spending`}
              onClick={() => {
                if (canReveal())
                  deleteSpending.mutate(entry.id, {
                    onError: () => toast.error('Could not delete the entry'),
                  });
              }}
            >
              <X className="size-3.5" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function NewTripForm() {
  const { hidden, canReveal } = useAmountVisibility();
  const createSpace = useCreateSpace();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    if (!name.trim()) {
      toast.error('Name the trip');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error('The trip cannot end before it starts');
      return;
    }
    createSpace.mutate(
      {
        kind: 'trip',
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
      {
        onSuccess: () => {
          setName('');
          setStartDate('');
          setEndDate('');
        },
        onError: () => toast.error('Could not create the trip'),
      }
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
    >
      <Input
        aria-label="New trip name"
        placeholder="New trip, e.g. Japan 2026"
        maxLength={80}
        disabled={hidden}
        value={hidden ? '' : name}
        onChange={(event) => {
          if (canReveal()) setName(event.target.value);
        }}
      />
      <Input
        aria-label="Trip start date"
        type="date"
        disabled={hidden}
        value={startDate}
        onChange={(event) => setStartDate(event.target.value)}
      />
      <Input
        aria-label="Trip end date"
        type="date"
        disabled={hidden}
        value={endDate}
        onChange={(event) => setEndDate(event.target.value)}
      />
      <Button
        type="submit"
        variant="outline"
        disabled={hidden || createSpace.isPending}
      >
        <Plane className="mr-1 size-4" />
        Add trip
      </Button>
    </form>
  );
}

function TripCard({ trip }: { trip: HouseholdSpace }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const deleteSpace = useDeleteSpace();
  const dates = [trip.startDate, trip.endDate]
    .filter((date): date is string => !!date)
    .map((date) => format(new Date(date), 'dd MMM yyyy'))
    .join(' – ');

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate font-semibold">{mask(trip.name)}</h4>
            {dates && <p className="text-muted-foreground text-xs">{dates}</p>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={hidden || deleteSpace.isPending}
            aria-label={`Delete trip ${mask(trip.name)}`}
            onClick={() => {
              if (canReveal())
                deleteSpace.mutate(trip.id, {
                  onError: () => toast.error('Could not delete the trip'),
                });
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <SpendingSummary
          entries={trip.entries}
          emptyLabel="No spending on this trip yet. Pick it in the form above."
        />
        <EntryList entries={trip.entries} />
      </CardContent>
    </Card>
  );
}

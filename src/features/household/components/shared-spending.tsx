'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { Plane, Plus, Trash2, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { QUICK_ADD_AMOUNT_ID } from '../constants';
import {
  useAddSpending,
  useCreateSpace,
  useDeleteSpace,
  useDeleteSpending,
} from '../hooks/use-household';
import { useUndoableDelete } from '../hooks/use-undoable-delete';
import { inMonth } from '../lib/shared-spending';
import type { HouseholdSpace, SharedSpendingEntry } from '../types';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { SpendingSummary } from './spending-summary';

const today = () => format(new Date(), 'yyyy-MM-dd');
const SELECT_CLASS =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50';

type FormErrors<K extends string> = Partial<Record<K, string>>;

/** Returns the same object when the field has no error so React skips the re-render. */
function omitError<K extends string>(
  errors: FormErrors<K>,
  field: K
): FormErrors<K> {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

/** Invisible 44px touch target that leaves row height untouched. */
const TOUCH_TARGET =
  'relative after:absolute after:-inset-2.5 after:content-[""]';

export function SharedSpending({ spaces }: { spaces: HouseholdSpace[] }) {
  const { hidden, canReveal } = useAmountVisibility();
  const createSpace = useCreateSpace();
  const { pendingIds } = useUndoableDelete();
  const monthId = useId();
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
    .filter((entry) => inMonth(entry.date, month) && !pendingIds.has(entry.id));

  return (
    <div className="space-y-6">
      <QuickAdd spaces={spaces} />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Household spending</h2>
            <div className="flex items-center gap-2">
              <Label htmlFor={monthId} className="text-xs">
                Month
              </Label>
              <Input
                id={monthId}
                type="month"
                className="w-40"
                value={month}
                onChange={(event) => {
                  if (event.target.value) setMonth(event.target.value);
                }}
              />
            </div>
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
          <h2 className="font-semibold">Trips</h2>
        </div>
        <NewTripForm />
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}

type QuickAddField = 'category' | 'amount' | 'date';

function QuickAdd({ spaces }: { spaces: HouseholdSpace[] }) {
  const { hidden, canReveal } = useAmountVisibility();
  const fieldId = useId();
  const addSpending = useAddSpending();
  const ordered = [
    ...spaces.filter((space) => space.kind === 'ongoing'),
    ...spaces.filter((space) => space.kind === 'trip').reverse(),
  ];
  const [spaceId, setSpaceId] = useState(ordered[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FormErrors<QuickAddField>>({});
  const categories = [
    ...new Set(spaces.flatMap((space) => space.entries.map((e) => e.category))),
  ].sort();
  const activeSpaceId = ordered.some((space) => space.id === spaceId)
    ? spaceId
    : (ordered[0]?.id ?? '');
  const ids: Record<QuickAddField, string> = {
    category: `${fieldId}-category`,
    amount: QUICK_ADD_AMOUNT_ID,
    date: `${fieldId}-date`,
  };

  function clearError(field: QuickAddField) {
    setErrors((current) => omitError(current, field));
  }

  function invalidProps(field: QuickAddField) {
    return errors[field]
      ? {
          'aria-invalid': true as const,
          'aria-describedby': `${ids[field]}-error`,
        }
      : {};
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const value = parseFloat(amount);
    const found: FormErrors<QuickAddField> = {};
    if (!category.trim()) found.category = 'Enter a category';
    if (!value || value <= 0) found.amount = 'Enter an amount above 0';
    if (!date) found.date = 'Pick a date';
    const firstInvalid = (['category', 'amount', 'date'] as const).find(
      (field) => found[field]
    );
    if (firstInvalid || !activeSpaceId) {
      setErrors(found);
      if (firstInvalid) document.getElementById(ids[firstInvalid])?.focus();
      return;
    }
    setErrors({});
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
          document.getElementById(QUICK_ADD_AMOUNT_ID)?.focus();
        },
        onError: () => toast.error('Could not add the spending'),
      }
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
            <div className="space-y-1">
              <Label htmlFor={ids.category} className="text-xs">
                Category
              </Label>
              <Input
                id={ids.category}
                list={`${fieldId}-categories`}
                placeholder="e.g. Groceries"
                maxLength={40}
                disabled={hidden}
                value={hidden ? '' : category}
                {...invalidProps('category')}
                onChange={(event) => {
                  if (!canReveal()) return;
                  setCategory(event.target.value);
                  clearError('category');
                }}
              />
              <datalist id={`${fieldId}-categories`}>
                {!hidden &&
                  categories.map((name) => <option key={name} value={name} />)}
              </datalist>
              <FieldError id={`${ids.category}-error`}>
                {errors.category}
              </FieldError>
            </div>
            <div className="space-y-1">
              <Label htmlFor={ids.amount} className="text-xs">
                Amount (SGD)
              </Label>
              <Input
                id={ids.amount}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="text-right tabular-nums"
                disabled={hidden}
                value={hidden ? '' : amount}
                {...invalidProps('amount')}
                onChange={(event) => {
                  if (!canReveal()) return;
                  setAmount(event.target.value);
                  clearError('amount');
                }}
              />
              <FieldError id={`${ids.amount}-error`}>
                {errors.amount}
              </FieldError>
            </div>
            <div className="flex sm:items-start sm:pt-[1.375rem]">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={hidden || addSpending.isPending}
              >
                <Plus className="mr-1 size-4" />
                Add
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[9rem_9rem_minmax(0,1fr)]">
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
              <Label htmlFor={ids.date} className="text-xs">
                Date
              </Label>
              <Input
                id={ids.date}
                type="date"
                disabled={hidden}
                value={date}
                {...invalidProps('date')}
                onChange={(event) => {
                  setDate(event.target.value);
                  clearError('date');
                }}
              />
              <FieldError id={`${ids.date}-error`}>{errors.date}</FieldError>
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EntryList({ entries }: { entries: SharedSpendingEntry[] }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const removeEntry = useDeleteSpending();
  const { request } = useUndoableDelete();
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
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={`text-muted-foreground hover:text-destructive ${TOUCH_TARGET}`}
              disabled={hidden}
              aria-label={`Delete ${mask(entry.category)} ${mask(
                formatSGD(entry.amount)
              )} on ${format(new Date(entry.date), 'dd MMM')}${
                entry.note ? ` ${mask(entry.note)}` : ''
              }`}
              onClick={() => {
                if (!canReveal()) return;
                request({
                  id: entry.id,
                  label: `${mask(entry.category)} entry deleted`,
                  commit: () => removeEntry.mutateAsync(entry.id),
                  errorMessage: 'Could not delete the entry',
                });
              }}
            >
              <X className="size-3.5" />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

type TripField = 'name' | 'dates';

function NewTripForm() {
  const { hidden, canReveal } = useAmountVisibility();
  const createSpace = useCreateSpace();
  const fieldId = useId();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<FormErrors<TripField>>({});
  const nameId = `${fieldId}-name`;
  const startId = `${fieldId}-start`;

  function clearError(field: TripField) {
    setErrors((current) => omitError(current, field));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const found: FormErrors<TripField> = {};
    if (!name.trim()) found.name = 'Enter a name';
    if (startDate && endDate && endDate < startDate)
      found.dates = 'The trip cannot end before it starts';
    if (found.name || found.dates) {
      setErrors(found);
      document.getElementById(found.name ? nameId : startId)?.focus();
      return;
    }
    setErrors({});
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

  const datesProps = errors.dates
    ? { 'aria-invalid': true as const, 'aria-describedby': `${startId}-error` }
    : {};
  const nameProps = errors.name
    ? { 'aria-invalid': true as const, 'aria-describedby': `${nameId}-error` }
    : {};

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
    >
      <div className="space-y-1">
        <Label htmlFor={nameId} className="text-xs">
          Trip name
        </Label>
        <Input
          id={nameId}
          placeholder="e.g. Japan 2026"
          maxLength={80}
          disabled={hidden}
          value={hidden ? '' : name}
          {...nameProps}
          onChange={(event) => {
            if (!canReveal()) return;
            setName(event.target.value);
            clearError('name');
          }}
        />
        <FieldError id={`${nameId}-error`}>{errors.name}</FieldError>
      </div>
      <div className="space-y-1">
        <Label htmlFor={startId} className="text-xs">
          From
        </Label>
        <Input
          id={startId}
          type="date"
          disabled={hidden}
          value={startDate}
          {...datesProps}
          onChange={(event) => {
            setStartDate(event.target.value);
            clearError('dates');
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${fieldId}-end`} className="text-xs">
          To
        </Label>
        <Input
          id={`${fieldId}-end`}
          type="date"
          disabled={hidden}
          value={endDate}
          {...datesProps}
          onChange={(event) => {
            setEndDate(event.target.value);
            clearError('dates');
          }}
        />
      </div>
      <div className="flex sm:items-start sm:pt-[1.375rem]">
        <Button
          type="submit"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={hidden || createSpace.isPending}
        >
          <Plane className="mr-1 size-4" />
          Add trip
        </Button>
      </div>
      <FieldError id={`${startId}-error`} className="sm:col-span-4">
        {errors.dates}
      </FieldError>
    </form>
  );
}

function TripCard({ trip }: { trip: HouseholdSpace }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const removeTrip = useDeleteSpace();
  const { pendingIds } = useUndoableDelete();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const entries = trip.entries.filter((entry) => !pendingIds.has(entry.id));
  const dates = [trip.startDate, trip.endDate]
    .filter((date): date is string => !!date)
    .map((date) => format(new Date(date), 'dd MMM yyyy'))
    .join(' – ');
  const entryCount = trip.entries.length;

  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{mask(trip.name)}</h3>
            {dates && <p className="text-muted-foreground text-xs">{dates}</p>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive pointer-coarse:size-11"
            disabled={hidden || removeTrip.isPending}
            aria-label={`Delete trip ${mask(trip.name)}`}
            onClick={() => {
              if (canReveal()) setConfirmOpen(true);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <SpendingSummary
          entries={entries}
          emptyLabel="No spending on this trip yet. Pick it in the form above."
        />
        <EntryList entries={entries} />
      </CardContent>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete trip ${mask(trip.name)}?`}
        description={`This also deletes ${entryCount} spending ${
          entryCount === 1 ? 'entry' : 'entries'
        }. This cannot be undone.`}
        confirmLabel="Delete trip"
        pending={removeTrip.isPending}
        onConfirm={() =>
          removeTrip.mutate(trip.id, {
            onSuccess: () => setConfirmOpen(false),
            onError: () => toast.error('Could not delete the trip'),
          })
        }
      />
    </Card>
  );
}

'use client';

import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatSGD } from '@/lib/utils/currency';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { GOAL_ITEM_LIMIT, GOAL_TEMPLATES } from '../constants';
import { useSaveGoal } from '../hooks/use-household';
import {
  usePlannerSplit,
  useSetPlannerSplit,
} from '../hooks/use-planner-split';
import { computeGoalDelta, type DraftItem } from '../lib/goal-delta';
import { saveGoalSchema } from '../schemas';
import { myPctFor, overrideFor, parsePct } from '../split-utils';
import type { HouseholdGoal } from '../types';
import { GoalSplitField } from './goal-split-override';

interface GoalEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when set; create mode otherwise. */
  goal?: HouseholdGoal | null;
}

interface ItemValues {
  id?: string;
  name: string;
  budget: string;
  quote: string;
  dueDate: string;
}

interface FormValues {
  name: string;
  target: string;
  targetDate: string;
  items: ItemValues[];
}

type Errors = Record<string, string>;

function Disclosure({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-none border-0 border-t">
      <AccordionTrigger className="px-0 py-3 text-sm font-medium">
        {title}
      </AccordionTrigger>
      <AccordionContent className="px-0">{children}</AccordionContent>
    </AccordionItem>
  );
}

const FIELD_MESSAGES: Record<string, string> = {
  name: 'Enter a name',
  target: 'Enter an amount above 0',
  items: 'Each budget line needs a unique id',
};

const SAVE_FAILED = 'Some changes were not saved, try again';

function toAmount(value: string): number {
  return value.trim() === '' ? NaN : Number(value);
}

function toDraft(values: FormValues) {
  const items = values.items.map((item) => ({
    ...(item.id ? { id: item.id } : {}),
    name: item.name,
    budget: toAmount(item.budget),
    quote: item.quote.trim() === '' ? null : toAmount(item.quote),
    dueDate: item.dueDate === '' ? null : item.dueDate,
  }));
  return {
    name: values.name,
    target: toAmount(values.target),
    ...(values.targetDate ? { targetDate: values.targetDate } : {}),
    items,
  };
}

function seed(goal: HouseholdGoal | null | undefined): FormValues {
  if (!goal) return { name: '', target: '', targetDate: '', items: [] };
  return {
    name: goal.name,
    target: goal.targetAmount.toFixed(2),
    targetDate: goal.targetDate?.slice(0, 10) ?? '',
    items: goal.items.map((item) => ({
      id: item.id,
      name: item.name,
      budget: item.budget.toFixed(2),
      quote: item.quote === null ? '' : item.quote.toFixed(2),
      dueDate: item.dueDate ?? '',
    })),
  };
}

export function GoalEditorSheet({
  open,
  onOpenChange,
  goal,
}: GoalEditorSheetProps) {
  const isEdit = !!goal;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit goal' : 'New goal'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Change the goal and its budget lines, then review before saving.'
              : 'A big item you and your partner are saving toward.'}
          </SheetDescription>
        </SheetHeader>
        <GoalEditorForm
          goal={goal ?? undefined}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function GoalEditorForm({
  goal,
  onDone,
}: {
  goal: HouseholdGoal | undefined;
  onDone: () => void;
}) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const save = useSaveGoal();
  const plannerSplit = usePlannerSplit();
  const saveSplit = useSetPlannerSplit();
  const [splitEdit, setSplitEdit] = useState<string | null>(null);
  const form = useForm<FormValues>({ defaultValues: seed(goal) });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  // Client-assigned so a retry after a partial save targets the same goal.
  const [goalId] = useState(() => goal?.id ?? crypto.randomUUID());
  const [stage, setStage] = useState<'edit' | 'review'>('edit');
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [template, setTemplate] = useState('');
  const splitData = plannerSplit.data;
  const splitText =
    splitEdit ??
    (splitData
      ? String(myPctFor(splitData, splitData.goalOverrides[goalId]))
      : '');
  const splitPct = parsePct(splitText);
  const hasOverride = splitData?.goalOverrides[goalId] !== undefined;
  const [showQuote, setShowQuote] = useState(
    () => goal?.items.some((item) => item.quote !== null) ?? false
  );
  const [showDates, setShowDates] = useState(
    () => goal?.items.some((item) => item.dueDate !== null) ?? false
  );

  const applyTemplate = (key: string) => {
    if (!canReveal()) return;
    setTemplate(key);
    const picked = GOAL_TEMPLATES.find((t) => t.id === key);
    if (!picked) return;
    form.setValue(
      'items',
      picked.items
        .map((name) => ({ name, budget: '', quote: '', dueDate: '' }))
        .slice(0, GOAL_ITEM_LIMIT)
    );
  };

  const review = form.handleSubmit((values) => {
    if (!canReveal()) return;
    if (splitData && splitPct === null) return;
    const parsed = saveGoalSchema.safeParse({ ...toDraft(values), goalId });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        next[key] ??= FIELD_MESSAGES[key] ?? 'Check this field';
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setStage('review');
  });

  // A new goal is seeded with the default split; an edited one only when changed.
  const persistSplit = async () => {
    const override =
      splitData && splitPct !== null ? overrideFor(splitData, splitPct) : null;
    if (!override || (goal && splitEdit === null)) return;
    try {
      await saveSplit.mutateAsync({ goalId, override });
    } catch {
      toast.error('Could not save the split, edit the goal to set it again');
    }
  };

  const confirm = () => {
    if (!canReveal()) return;
    const values = form.getValues();
    save.mutate(
      { ...toDraft(values), goalId },
      {
        onSuccess: async (result) => {
          if (result.ok) {
            await persistSplit();
            toast.success(goal ? 'Goal updated' : 'Goal created');
            onDone();
            return;
          }
          if (result.code === 'VALIDATION') {
            setErrors({ items: 'Check the highlighted fields' });
            setStage('edit');
            return;
          }
          // Ids from the partial write keep the retry from duplicating rows.
          result.itemIds.forEach((id, index) =>
            form.setValue(`items.${index}.id`, id)
          );
          setFailed(true);
          setStage('edit');
        },
        onError: () => {
          setFailed(true);
          setStage('edit');
        },
      }
    );
  };

  const values = useWatch({ control: form.control }) as FormValues;
  const draftForDelta = {
    target: toAmount(values.target) || 0,
    items: toDraft(values).items.map(
      (item): DraftItem => ({
        ...item,
        budget: Number.isFinite(item.budget) ? item.budget : 0,
        quote:
          item.quote !== null && Number.isFinite(item.quote)
            ? item.quote
            : null,
      })
    ),
  };

  if (stage === 'review') {
    const delta = computeGoalDelta(goal, draftForDelta);
    const money = (n: number | null) => (n === null ? '' : mask(formatSGD(n)));
    return (
      <>
        <div className="space-y-4 px-4" aria-label="Changes to save">
          <h3 className="text-sm font-medium">Review changes</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Target</dt>
              <dd className="tabular-nums">
                {delta.targetOld !== null && `${money(delta.targetOld)} -> `}
                {money(delta.targetNew)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Committed</dt>
              <dd className="tabular-nums">
                {delta.committedOld !== null &&
                  `${money(delta.committedOld)} -> `}
                {money(delta.committedNew)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Budget lines</dt>
              <dd>
                {delta.added} added, {delta.changed} changed, {delta.removed}{' '}
                removed
              </dd>
            </div>
          </dl>
          {delta.removedWithPayments.length > 0 && (
            <p role="alert" className="text-destructive text-sm">
              Removing {mask(delta.removedWithPayments.join(', '))} also deletes
              the payments recorded against it.
            </p>
          )}
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => setStage('edit')}
            disabled={save.isPending}
          >
            Back
          </Button>
          <Button onClick={confirm} disabled={save.isPending}>
            Confirm and save
          </Button>
        </SheetFooter>
      </>
    );
  }

  return (
    <form onSubmit={review} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
        <AmountsHiddenNotice />
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {SAVE_FAILED}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="goal-name">Name</Label>
          <Input
            id="goal-name"
            disabled={hidden}
            maxLength={80}
            placeholder="e.g. New sofa"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'goal-name-error' : undefined}
            {...form.register('name')}
          />
          <FieldError id="goal-name-error">{errors.name}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-target">Target amount (SGD)</Label>
          <Input
            id="goal-target"
            disabled={hidden}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="text-right tabular-nums"
            aria-invalid={errors.target ? true : undefined}
            aria-describedby={errors.target ? 'goal-target-error' : undefined}
            {...form.register('target')}
          />
          <FieldError id="goal-target-error">{errors.target}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-date">Target date (optional)</Label>
          <Input
            id="goal-date"
            disabled={hidden}
            type="date"
            {...form.register('targetDate')}
          />
        </div>

        <Accordion
          type="multiple"
          defaultValue={fields.length > 0 ? ['cost'] : []}
        >
          <Disclosure value="cost" title="Break down the cost">
            <div className="space-y-3">
              {!goal && (
                <div className="space-y-1.5">
                  <Label htmlFor="goal-template">Start from a template</Label>
                  <Select
                    value={template}
                    onValueChange={applyTemplate}
                    disabled={hidden}
                  >
                    <SelectTrigger id="goal-template" className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <fieldset className="space-y-3">
                <legend className="sr-only">Budget lines</legend>
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-2">
                    <div className="grid grid-cols-[1fr_6rem_auto] items-start gap-2">
                      <Input
                        aria-label={`Item ${index + 1} name`}
                        disabled={hidden}
                        maxLength={80}
                        placeholder="Item"
                        aria-invalid={
                          errors[`items.${index}.name`] ? true : undefined
                        }
                        {...form.register(`items.${index}.name`)}
                      />
                      <Input
                        aria-label={`Item ${index + 1} estimate`}
                        disabled={hidden}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Estimate"
                        className="text-right tabular-nums"
                        aria-invalid={
                          errors[`items.${index}.budget`] ? true : undefined
                        }
                        {...form.register(`items.${index}.budget`)}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={hidden}
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {(showQuote || showDates) && (
                      <div className="grid grid-cols-2 gap-2">
                        {showQuote && (
                          <Input
                            aria-label={`Item ${index + 1} final quote`}
                            disabled={hidden}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Final quote"
                            className="text-right tabular-nums"
                            aria-invalid={
                              errors[`items.${index}.quote`] ? true : undefined
                            }
                            {...form.register(`items.${index}.quote`)}
                          />
                        )}
                        {showDates && (
                          <Input
                            aria-label={`Item ${index + 1} due date`}
                            disabled={hidden}
                            type="date"
                            className="col-start-2"
                            aria-invalid={
                              errors[`items.${index}.dueDate`]
                                ? true
                                : undefined
                            }
                            {...form.register(`items.${index}.dueDate`)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <FieldError id="goal-items-error">
                  {Object.keys(errors).some((key) => key.startsWith('items.'))
                    ? 'Each item needs a name and an estimate above 0'
                    : errors.items}
                </FieldError>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={hidden || fields.length >= GOAL_ITEM_LIMIT}
                  onClick={() =>
                    append({ name: '', budget: '', quote: '', dueDate: '' })
                  }
                >
                  <Plus className="mr-1 size-3.5" />
                  Add item
                </Button>
                {fields.length > 0 && !showQuote && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowQuote(true)}
                  >
                    Got a final quote?
                  </Button>
                )}
                {fields.length > 0 && !showDates && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDates(true)}
                  >
                    Add payment dates
                  </Button>
                )}
              </div>
            </div>
          </Disclosure>
        </Accordion>
        {splitData && (
          <Accordion
            key={hasOverride ? 'override' : 'default'}
            type="multiple"
            defaultValue={hasOverride ? ['split'] : []}
          >
            <Disclosure value="split" title="Different split">
              <GoalSplitField value={splitText} onChange={setSplitEdit} />
            </Disclosure>
          </Accordion>
        )}
      </div>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={hidden}>
          Review changes
        </Button>
      </SheetFooter>
    </form>
  );
}

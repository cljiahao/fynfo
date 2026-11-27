'use client';

import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { GOAL_ITEM_LIMIT, GOAL_TEMPLATES } from '../constants';
import { useSaveGoal, useUpdateGoal } from '../hooks/use-household';
import {
  usePlannerSplit,
  useSetPlannerSplit,
} from '../hooks/use-planner-split';
import { saveGoalSchema, updateGoalSchema } from '../schemas';
import {
  goalMemberIds,
  goalPctsFor,
  parsePct,
  parsePctMap,
  pctMapToText,
  seedPctsFor,
  type PctText,
} from '../split-utils';
import type { HouseholdGoal } from '../types';
import { GoalSplitField } from './goal-split-override';

interface GoalEditorDialogProps {
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

export function GoalEditorDialog({
  open,
  onOpenChange,
  goal,
}: GoalEditorDialogProps) {
  const isEdit = !!goal;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit goal' : 'New goal'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Change the goal name, target amount or target date.'
              : 'A big item your household is saving toward.'}
          </DialogDescription>
        </DialogHeader>
        <GoalEditorForm
          goal={goal ?? undefined}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function GoalEditorForm({
  goal,
  onDone,
}: {
  goal: HouseholdGoal | undefined;
  onDone: () => void;
}) {
  const { hidden, canReveal } = useAmountVisibility();
  const save = useSaveGoal();
  const update = useUpdateGoal();
  const plannerSplit = usePlannerSplit();
  const saveSplit = useSetPlannerSplit();
  const [splitEdit, setSplitEdit] = useState<PctText | null>(null);
  const form = useForm<FormValues>({ defaultValues: seed(goal) });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  // Client-assigned so a retry after a partial save targets the same goal.
  const [goalId] = useState(() => goal?.id ?? crypto.randomUUID());
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [template, setTemplate] = useState('');
  const splitData = plannerSplit.data;
  const splitMemberIds = splitData
    ? goalMemberIds(Object.keys(splitData.members).sort(), goal?.memberIds)
    : [];
  const splitText: PctText =
    splitEdit ??
    (splitData
      ? pctMapToText(
          goal
            ? goalPctsFor(splitData.goalOverrides[goalId], splitMemberIds)
            : seedPctsFor(splitData, splitMemberIds),
          splitMemberIds
        )
      : {});
  const splitPcts = parsePctMap(splitText, splitMemberIds);
  const hasOverride = splitData?.goalOverrides[goalId] !== undefined;
  const [costOpen, setCostOpen] = useState(false);
  // null until the user toggles it, so an override that loads late still opens it.
  const [splitChoice, setSplitChoice] = useState<boolean | null>(null);
  const splitOpen = splitChoice ?? hasOverride;
  const [showQuote, setShowQuote] = useState(false);
  const [showDates, setShowDates] = useState(false);

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

  // A new goal is seeded with the default split; an edited one only when changed.
  const persistSplit = async () => {
    const override = splitData ? splitPcts : null;
    if (!override || (goal && splitEdit === null)) return;
    try {
      await saveSplit.mutateAsync({ goalId, override });
    } catch {
      toast.error('Could not save the split, edit the goal to set it again');
    }
  };

  const pending = save.isPending || update.isPending;

  const showErrors = (issues: { path: PropertyKey[] }[]) => {
    const next: Errors = {};
    for (const issue of issues) {
      const key = issue.path.join('.');
      const field = key === 'targetAmount' ? 'target' : key;
      next[field] ??= FIELD_MESSAGES[field] ?? 'Check this field';
    }
    setErrors(next);
    if (Object.keys(next).some((key) => key.startsWith('items'))) {
      setCostOpen(true);
    }
  };

  const saveEdit = (values: FormValues) => {
    const draft = toDraft(values);
    const input = {
      goalId,
      name: draft.name,
      targetAmount: draft.target,
      ...(draft.targetDate ? { targetDate: draft.targetDate } : {}),
    };
    const parsed = updateGoalSchema.safeParse(input);
    if (!parsed.success) {
      showErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    setFailed(false);
    update.mutate(parsed.data, {
      onSuccess: async () => {
        await persistSplit();
        toast.success('Goal updated');
        onDone();
      },
      onError: () => setFailed(true),
    });
  };

  const saveCreate = (values: FormValues) => {
    const parsed = saveGoalSchema.safeParse({ ...toDraft(values), goalId });
    if (!parsed.success) {
      showErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    setFailed(false);
    save.mutate(parsed.data, {
      onSuccess: async (result) => {
        if (result.ok) {
          await persistSplit();
          toast.success('Goal created');
          onDone();
          return;
        }
        if (result.code === 'VALIDATION') {
          setErrors({ items: 'Check the highlighted fields' });
          setCostOpen(true);
          return;
        }
        // Ids from the partial write keep the retry from duplicating rows.
        result.itemIds.forEach((id, index) =>
          form.setValue(`items.${index}.id`, id)
        );
        setFailed(true);
      },
      onError: () => setFailed(true),
    });
  };

  const submit = form.handleSubmit((values) => {
    if (!canReveal() || pending) return;
    // An untouched split is always the seeded one, so it never blocks other edits.
    if (splitData && splitEdit !== null && splitPcts === null) {
      const typed = splitMemberIds.every(
        (id) => parsePct(splitText[id] ?? '') !== null
      );
      setErrors({
        split: typed
          ? 'Shares must total 100%'
          : 'Enter a whole number from 0 to 100',
      });
      setSplitChoice(true);
      return;
    }
    if (goal) saveEdit(values);
    else saveCreate(values);
  });

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
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

        {!goal && (
          <Accordion
            type="multiple"
            value={costOpen ? ['cost'] : []}
            onValueChange={(value) => setCostOpen(value.includes('cost'))}
          >
            <Disclosure value="cost" title="Break down the cost">
              <div className="space-y-3">
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
                                errors[`items.${index}.quote`]
                                  ? true
                                  : undefined
                              }
                              {...form.register(`items.${index}.quote`)}
                            />
                          )}
                          {showDates && (
                            <div
                              className={
                                showQuote
                                  ? 'flex items-center gap-2'
                                  : 'col-span-2 flex items-center gap-2'
                              }
                            >
                              <span
                                aria-hidden
                                className="text-muted-foreground text-xs"
                              >
                                Due
                              </span>
                              <Input
                                aria-label={`Item ${index + 1} due date`}
                                disabled={hidden}
                                type="date"
                                aria-invalid={
                                  errors[`items.${index}.dueDate`]
                                    ? true
                                    : undefined
                                }
                                {...form.register(`items.${index}.dueDate`)}
                              />
                            </div>
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
                      className="min-h-10"
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
                      className="min-h-10"
                      onClick={() => setShowDates(true)}
                    >
                      Add payment dates
                    </Button>
                  )}
                </div>
              </div>
            </Disclosure>
          </Accordion>
        )}
        {splitData && (
          <Accordion
            type="multiple"
            value={splitOpen ? ['split'] : []}
            onValueChange={(value) => setSplitChoice(value.includes('split'))}
          >
            <Disclosure value="split" title="Different split">
              <GoalSplitField
                memberIds={splitMemberIds}
                value={splitText}
                onChange={setSplitEdit}
              />
              <FieldError id="goal-split-error">{errors.split}</FieldError>
            </Disclosure>
          </Accordion>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={hidden || pending}>
          {goal ? 'Save goal' : 'Create goal'}
        </Button>
      </DialogFooter>
    </form>
  );
}

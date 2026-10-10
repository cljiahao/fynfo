'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatSGD } from '@/lib/utils/currency';
import { useEffect, useId, useRef, useState } from 'react';
import { SCENARIO_SLICES } from '../constants';
import { useScenarioMutations, useScenarios } from '../hooks/use-scenarios';
import { computeSalaryPlan, type SalaryPlanInput } from '../lib/salary-plan';
import { isScenarioPlanFinite } from '../lib/scenario-plan';
import { scenarioPayloadSchema } from '../schemas';
import type { ScenarioPayload, ScenarioRecord } from '../types';
import { PlannerInputs } from './planner-inputs';
import { PlannerResults } from './planner-results';

interface ScenarioDialogProps {
  initialPayload: ScenarioPayload;
  initialRecord?: ScenarioRecord;
  onClose: () => void;
  onSaved?: () => void;
  onReturnFocus?: () => void;
}

export function ScenarioDialog({
  initialPayload,
  initialRecord,
  onClose,
  onSaved,
  onReturnFocus,
}: ScenarioDialogProps) {
  const [payload, setPayload] = useState(initialPayload);
  const [record, setRecord] = useState(initialRecord);
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [reloaded, setReloaded] = useState(false);
  const [reviewRecord, setReviewRecord] = useState<ScenarioRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const pending = useRef(false);
  const alive = useRef(false);
  const operation = useRef(0);
  const ambiguousRequest = useRef<string | null>(null);
  const ids = useId();
  const query = useScenarios(true);
  const { create, update } = useScenarioMutations();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      operation.current += 1;
    };
  }, []);
  const close = () => {
    alive.current = false;
    operation.current += 1;
    onClose();
  };
  const change = <K extends keyof SalaryPlanInput>(
    key: K,
    value: SalaryPlanInput[K]
  ) =>
    setPayload((draft) => ({
      ...draft,
      inputs: { ...draft.inputs, [key]: value },
    }));
  const plan = computeSalaryPlan(payload.inputs);
  const valid =
    scenarioPayloadSchema.safeParse(payload).success &&
    isScenarioPlanFinite(plan);
  const inputsValid =
    scenarioPayloadSchema.safeParse({
      ...payload,
      name: payload.name.trim() || 'Draft',
    }).success && isScenarioPlanFinite(plan);
  const pieData = SCENARIO_SLICES.filter(
    (slice) => !('enabled' in slice) || payload.inputs[slice.enabled]
  ).map((slice) => ({
    name: slice.label,
    value: Math.max(plan[slice.amount], 0),
    fill: slice.color,
  }));
  const breakdownItems = SCENARIO_SLICES.filter(
    (slice) => !('enabled' in slice) || payload.inputs[slice.enabled]
  ).map((slice) => ({
    label: `${slice.label} (${(plan[slice.percent] * 100).toFixed(1)}%)`,
    value: plan[slice.amount],
    color: slice.color,
  }));
  const reload = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const ticket = ++operation.current;
    try {
      const result = await query.refetch();
      if (!alive.current || ticket !== operation.current) return;
      if (result.isError || !result.data) {
        setMessage(
          'Reload failed. Your draft is preserved. Unlock your vault and reload.'
        );
        return;
      }
      const latest = ambiguousRequest.current
        ? result.data.find(
            (item) => item.creationRequestId === ambiguousRequest.current
          )
        : result.data.find((item) => item.id === record?.id);
      setReviewRecord(latest ?? null);
      setReloaded(true);
      setMessage(
        latest
          ? 'Latest saved row found. Review saved row to replace this draft, or explicitly Save as new.'
          : 'No current saved row found. This does not confirm whether an earlier save was deleted. Your draft is preserved; Save as new starts a new request.'
      );
    } catch {
      if (alive.current && ticket === operation.current)
        setMessage('Reload failed. Your draft is preserved.');
    } finally {
      pending.current = false;
      if (alive.current && ticket === operation.current) setBusy(false);
    }
  };
  const save = async (asNew: boolean) => {
    if (pending.current || !valid || (blocked && (!asNew || !reloaded))) return;
    pending.current = true;
    setBusy(true);
    const ticket = ++operation.current;
    const creationRequestId = asNew || !record ? crypto.randomUUID() : null;
    ambiguousRequest.current = creationRequestId;
    try {
      const result = creationRequestId
        ? await create.mutateAsync({ creationRequestId, payload })
        : await update.mutateAsync({
            id: record!.id,
            revision: record!.revision,
            payload,
          });
      if (!alive.current || ticket !== operation.current) return;
      if (result.status === 'CAPACITY') {
        setMessage(
          'No available scenario slot. Reload scenarios or delete a saved plan before saving.'
        );
        setBlocked(true);
        setReloaded(false);
        return;
      }
      if (result.status === 'CONFLICT' || result.status === 'EXISTING') {
        setBlocked(true);
        setReloaded(false);
        setMessage(
          'Save requires review. Your draft is preserved. Reload saved rows before retrying.'
        );
        return;
      }
      onSaved?.();
      close();
    } catch {
      if (alive.current && ticket === operation.current) {
        setBlocked(true);
        setReloaded(false);
        setMessage(
          'Save could not be confirmed. Your draft is preserved. Reload saved rows before any new save.'
        );
      }
    } finally {
      pending.current = false;
      if (alive.current && ticket === operation.current) setBusy(false);
    }
  };
  const review = () => {
    if (!reviewRecord) return;
    setPayload(reviewRecord.payload);
    setRecord(reviewRecord);
    setReviewRecord(null);
    setBlocked(false);
    setReloaded(false);
    ambiguousRequest.current = null;
    setMessage('Latest saved row loaded. Edits remain hypothetical.');
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
        onCloseAutoFocus={(event) => {
          if (onReturnFocus) {
            event.preventDefault();
            onReturnFocus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {record ? 'Saved planning scenario' : 'Save current plan'}
          </DialogTitle>
          <DialogDescription>
            Hypothetical ·{' '}
            {record
              ? `saved ${new Date(record.updatedAt).toLocaleDateString()}`
              : `captured ${new Date(payload.capturedAt).toLocaleDateString()}`}{' '}
            · SGD. Flat 20% CPF, fixed 5% insurance, reserves funded over 9
            months.
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Captured inputs stay separate from your live planner and actual
          records. Closing discards unsaved edits; an already submitted save may
          still finish.{' '}
          {payload.sourceSnapshotMonth &&
            `Snapshot source: ${payload.sourceSnapshotMonth}. `}
          Captured savings: {formatSGD(payload.inputs.currentSavings)}; bonds:{' '}
          {formatSGD(payload.inputs.currentBonds)}. These balances do not
          refresh automatically.
        </p>
        <div className="space-y-2">
          <Label htmlFor={`${ids}-name`}>Scenario name</Label>
          <Input
            id={`${ids}-name`}
            maxLength={80}
            disabled={busy}
            required
            aria-invalid={nameTouched && !payload.name.trim()}
            aria-describedby={`${ids}-name-guidance`}
            onBlur={() => setNameTouched(true)}
            value={payload.name}
            onChange={(event) =>
              setPayload((draft) => ({ ...draft, name: event.target.value }))
            }
          />
          <p
            id={`${ids}-name-guidance`}
            className="text-muted-foreground text-xs"
          >
            {nameTouched && !payload.name.trim()
              ? 'Enter a scenario name to save.'
              : 'Use a name with 1–80 characters.'}
          </p>
        </div>
        <fieldset disabled={busy} className="space-y-5">
          <legend className="sr-only">Hypothetical scenario inputs</legend>
          <PlannerInputs
            allowZeroFractionalReserves
            idPrefix={ids}
            {...payload.inputs}
            avgExpenses={0}
            setSalary={(value) => change('salary', value)}
            setExpenses={(value) => change('expenses', value)}
            setEmergencyMonths={(value) => change('emergencyMonths', value)}
            setWarChestMonths={(value) => change('warChestMonths', value)}
          />
          {inputsValid ? (
            <PlannerResults
              idPrefix={ids}
              {...payload.inputs}
              {...plan}
              pieData={pieData}
              breakdownItems={breakdownItems}
              setTitheEnabled={(value) => change('titheEnabled', value)}
              setTithePctInput={(value) => change('tithePctInput', value)}
              setAllowanceEnabled={(value) => change('allowanceEnabled', value)}
              setAllowancePctInput={(value) =>
                change('allowancePctInput', value)
              }
            />
          ) : (
            <p role="alert" className="text-loss text-sm">
              Scenario unavailable: inputs exceed saved-plan bounds or produce a
              nonfinite result. Adjust the inputs before saving.
            </p>
          )}
        </fieldset>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {blocked && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                void reload();
              }}
            >
              Reload saved rows
            </Button>
            {reviewRecord && (
              <Button variant="outline" disabled={busy} onClick={review}>
                Review saved row (replace draft)
              </Button>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          {record && (
            <Button
              disabled={busy || blocked || !valid}
              onClick={() => {
                void save(false);
              }}
            >
              Save changes
            </Button>
          )}
          <Button
            variant={record ? 'outline' : 'default'}
            disabled={busy || !valid || (blocked && !reloaded)}
            onClick={() => {
              void save(true);
            }}
          >
            {busy ? 'Saving…' : 'Save as new'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

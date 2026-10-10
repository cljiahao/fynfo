'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useRef, useState } from 'react';
import { useScenarioMutations, useScenarios } from '../hooks/use-scenarios';
import type { SalaryPlanInput } from '../lib/salary-plan';
import type { ScenarioPayload, ScenarioRecord } from '../types';
import { ScenarioDialog } from './scenario-dialog';

interface PlanningScenariosProps {
  inputs: SalaryPlanInput;
  sourceSnapshotMonth?: string;
}

export function PlanningScenarios({
  inputs,
  sourceSnapshotMonth,
}: PlanningScenariosProps) {
  const [expanded, setExpanded] = useState(false);
  const query = useScenarios(expanded);
  const { remove } = useScenarioMutations();
  const [editor, setEditor] = useState<{
    key: string;
    payload: ScenarioPayload;
    record?: ScenarioRecord;
    trigger: HTMLButtonElement | null;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const alive = useRef(false);
  const disclosureRef = useRef<HTMLButtonElement>(null);
  const editorKeyRef = useRef<string | null>(null);
  const request = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current += 1;
    };
  }, []);
  const open = (
    record?: ScenarioRecord,
    trigger: HTMLButtonElement | null = null
  ) => {
    const payload: ScenarioPayload = record?.payload ?? {
      schemaVersion: 1,
      name: '',
      model: 'allocation-flat-cpf-v1',
      currency: 'SGD',
      capturedAt: new Date().toISOString(),
      ...(sourceSnapshotMonth ? { sourceSnapshotMonth } : {}),
      inputs: { ...inputs },
    };
    const key = crypto.randomUUID();
    editorKeyRef.current = key;
    setEditor({ key, payload, record, trigger });
  };
  const deleteSaved = async (record: ScenarioRecord) => {
    if (pending.current || reloadRequired) return;
    pending.current = true;
    const operation = ++request.current;
    try {
      const result = await remove.mutateAsync({
        id: record.id,
        revision: record.revision,
      });
      if (!alive.current || operation !== request.current) return;
      if (result.status === 'CONFLICT') {
        setReloadRequired(true);
        setMessage(
          'This scenario changed or was deleted. Reload before trying again.'
        );
      } else {
        setMessage('Scenario deleted.');
        setConfirmDelete(null);
      }
    } catch {
      if (alive.current && operation === request.current) {
        setReloadRequired(true);
        setMessage(
          'Delete could not be confirmed. Reload before trying again.'
        );
      }
    } finally {
      pending.current = false;
    }
  };
  const reload = async () => {
    const operation = ++request.current;
    const result = await query.refetch();
    if (!alive.current || operation !== request.current) return;
    if (!result.isError) {
      setReloadRequired(false);
      setConfirmDelete(null);
      setMessage(
        'Latest saved scenarios loaded. Review before making changes.'
      );
    }
  };
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Saved scenarios">
      <Button
        variant="ghost"
        className="w-full justify-between"
        ref={disclosureRef}
        aria-expanded={expanded}
        aria-controls="saved-scenarios-content"
        onClick={() => setExpanded(!expanded)}
      >
        Saved scenarios{' '}
        <span className="text-muted-foreground text-xs">
          Private · up to 10
        </span>
      </Button>
      {expanded && (
        <div id="saved-scenarios-content" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Name a hypothetical plan and reopen its captured inputs. Saved
            scenarios use your personal vault.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={(event) => open(undefined, event.currentTarget)}
            >
              Save current plan
            </Button>
            <Button
              variant="ghost"
              disabled={query.isFetching}
              onClick={() => {
                void reload();
              }}
            >
              Reload scenarios
            </Button>
          </div>
          {query.isPending && <Skeleton className="h-16 w-full" />}
          {query.isError && (
            <p role="alert" className="text-loss text-sm">
              Scenarios unavailable. Unlock your vault and reload scenarios.
            </p>
          )}
          {!query.isPending && !query.isError && query.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No saved scenarios yet. Save current plan to capture its inputs.
            </p>
          )}
          {!query.isError && (
            <ul className="divide-y">
              {query.data?.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">
                      {record.payload.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Hypothetical · saved{' '}
                      {new Date(record.updatedAt).toLocaleDateString()} · SGD
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Open ${record.payload.name}`}
                      onClick={(event) => open(record, event.currentTarget)}
                    >
                      Open
                      <span className="sr-only"> {record.payload.name}</span>
                    </Button>
                    {confirmDelete === record.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={remove.isPending || reloadRequired}
                          onClick={() => {
                            void deleteSaved(record);
                          }}
                        >
                          Confirm delete
                          <span className="sr-only">
                            {' '}
                            {record.payload.name}
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={reloadRequired}
                        onClick={() => setConfirmDelete(record.id)}
                      >
                        Delete
                        <span className="sr-only"> {record.payload.name}</span>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </div>
      )}
      {editor && (
        <ScenarioDialog
          key={editor.key}
          initialPayload={editor.payload}
          initialRecord={editor.record}
          onClose={() => setEditor(null)}
          onSaved={() => setMessage('Scenario saved.')}
          onReturnFocus={() => {
            if (!alive.current || editorKeyRef.current !== editor.key) return;
            const target = editor.trigger?.isConnected
              ? editor.trigger
              : disclosureRef.current;
            if (target?.isConnected && !target.closest('[hidden]'))
              target.focus();
          }}
        />
      )}
    </section>
  );
}

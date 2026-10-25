'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { useStatementSave } from '../hooks/use-statement-save';

type SaveReview = ReturnType<typeof useStatementSave>;

export function ImportProgressOverlay({ save }: { save: SaveReview }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  const { activity, progress, checking } = save;
  const title =
    activity === 'save'
      ? 'Saving expenses'
      : activity === 'verify'
        ? 'Checking saved expenses'
        : 'Checking for duplicates';
  return (
    <div className="bg-background/80 absolute inset-0 z-20 flex items-center justify-center rounded-lg backdrop-blur-sm">
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-card w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-lg outline-none"
      >
        <div className="flex items-center gap-3">
          <Loader2
            className="text-brand size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <h3 id={titleId} className="font-medium">
            {title}
          </h3>
        </div>
        {activity === 'save' && progress ? (
          <div className="space-y-2">
            <progress
              value={progress.done}
              max={progress.total}
              aria-label="Save progress"
              className="bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-brand [&::-moz-progress-bar]:bg-brand block h-2 w-full appearance-none overflow-hidden rounded-full"
            />
            <p className="text-sm tabular-nums" role="status">
              Saving {progress.done} of {progress.total} · group{' '}
              {progress.group} of {progress.groups}
            </p>
            <p className="text-muted-foreground text-sm">
              Keep this window open until saving finishes.
            </p>
          </div>
        ) : activity === 'verify' ? (
          <p className="text-muted-foreground text-sm" role="status">
            Reading your saved expenses to confirm each submission.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm" role="status">
              Checking {checking} expense{checking === 1 ? '' : 's'} against
              your saved records…
            </p>
            <Button type="button" variant="outline" onClick={save.cancelCheck}>
              Cancel check
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

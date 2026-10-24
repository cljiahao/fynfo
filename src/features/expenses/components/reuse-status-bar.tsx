'use client';

import { Button } from '@/components/ui/button';
import { useAmountVisibility } from '@/features/privacy';
import type { ReusePhase } from './expense-quick-add';

export function ReuseStatusBar({
  errorId,
  reuseError,
  phase,
  frozen,
  canCheck,
  onCancel,
  onCheck,
  onRetry,
}: {
  errorId: string;
  reuseError: string;
  phase: ReusePhase;
  frozen: boolean;
  canCheck: boolean;
  onCancel: () => void;
  onCheck: () => void;
  onRetry: () => void;
}) {
  const { hidden } = useAmountVisibility();
  return (
    <div className="mb-3 space-y-2">
      <p role="status" className="text-sm">
        Reused expense · Date set to today · Self expense
      </p>
      {reuseError && (
        <p id={errorId} role="alert" className="text-loss-strong text-sm">
          {reuseError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={hidden || frozen}
          onClick={onCancel}
        >
          Cancel reuse
        </Button>
        {(phase === 'unconfirmed' ||
          phase === 'conflict' ||
          phase === 'checking') && (
          <Button
            variant="outline"
            size="sm"
            disabled={hidden || phase === 'checking' || !canCheck}
            onClick={onCheck}
          >
            {phase === 'checking' ? 'Checking expenses…' : 'Check expenses'}
          </Button>
        )}
        {phase === 'unconfirmed' && (
          <Button size="sm" disabled={hidden} onClick={onRetry}>
            Retry same expense
          </Button>
        )}
      </div>
    </div>
  );
}

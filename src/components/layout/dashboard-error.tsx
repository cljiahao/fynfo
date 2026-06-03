'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Canonical dashboard error UI, shared by every dashboard route's error.tsx
// boundary. Next passes the `{ error, reset }` contract; `digest` is the
// server-side correlation id for an opaque failure.
export function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="text-destructive size-10" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        An unexpected error occurred while loading the dashboard. Please try
        again.
      </p>
      {error.digest && (
        <p className="text-muted-foreground/70 font-mono text-xs">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}

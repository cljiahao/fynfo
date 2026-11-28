'use client';

import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// Client component: needs navigator.clipboard and local copied state.
export function CallersKeyId({ keyId }: { keyId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(keyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the key ID');
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <code className="bg-muted rounded px-1.5 py-0.5 text-xs break-all">
        {keyId}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={copy}
        aria-label="Copy key ID"
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </span>
  );
}

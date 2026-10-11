'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useId, useRef, useState } from 'react';
import {
  EXPORT_REVIEW_DOMAINS,
  EXPORT_REVIEW_MAX_BYTES,
} from '../lib/export-review-constants';
import {
  reviewExportJson,
  type ExportReviewResult,
} from '../lib/export-validation';

export function ExportReview() {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<ExportReviewResult | null>(null);
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );

  function clearReview() {
    generation.current++;
    setReading(false);
    setResult(null);
    if (input.current) {
      input.current.value = '';
      input.current.focus();
    }
  }

  async function inspectFile(file: File) {
    const current = ++generation.current;
    setResult(null);
    setReading(true);
    if (file.size > EXPORT_REVIEW_MAX_BYTES) {
      setResult({
        ok: false,
        error:
          'This file exceeds the 1 MiB local review limit. Choose a smaller JSON export.',
      });
      setReading(false);
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      if (current !== generation.current) return;
      const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      setResult(reviewExportJson(content));
    } catch {
      if (current === generation.current)
        setResult({
          ok: false,
          error:
            'The file could not be read as UTF-8. Choose the JSON export again.',
        });
    } finally {
      if (current === generation.current) setReading(false);
    }
  }

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="space-y-3 border-t pt-4"
    >
      <h3 id={`${inputId}-heading`} className="font-medium">
        Review a JSON export
      </h3>
      <p id={`${inputId}-help`} className="text-muted-foreground text-sm">
        Processed on this device. Review versions 1–3, up to 1 MiB and 10,000
        rows including nested entries and splits. Nothing is uploaded or saved.
        This checks the file format; it cannot verify ownership, completeness, a
        consistent snapshot, or whether the data can be restored. Household data
        is excluded.
      </p>
      <div className="space-y-2">
        <Label htmlFor={inputId}>Fynfo JSON export</Label>
        <Input
          ref={input}
          id={inputId}
          type="file"
          accept=".json,application/json"
          aria-describedby={`${inputId}-help`}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void inspectFile(file);
          }}
        />
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-3"
      >
        {reading && (
          <p className="text-muted-foreground text-sm">
            Reading on this device…
          </p>
        )}
        {result && !result.ok && (
          <p className="text-destructive text-sm">{result.error}</p>
        )}
        {result?.ok && (
          <>
            <p className="text-sm">
              Supported format, version {result.summary.version}. No records
              were changed.
            </p>
            <p className="text-muted-foreground text-sm break-words">
              Export timestamp: {result.summary.exportedAt}
            </p>
            {result.summary.warnings.map((warning) => (
              <p key={warning} className="text-sm">
                {warning}
              </p>
            ))}
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
              {EXPORT_REVIEW_DOMAINS.map((domain) => (
                <div key={domain.key} className="contents">
                  <dt>{domain.label}</dt>
                  <dd className="text-right tabular-nums">
                    {result.summary.counts[domain.key] ?? 'Not included'}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
      {(reading || result) && (
        <Button type="button" variant="outline" onClick={clearReview}>
          Clear review
        </Button>
      )}
    </section>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { useAmountVisibility } from '@/features/privacy';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { STATEMENT_ZOOM_LEVELS } from '../constants';
import { usePanZoom } from '../hooks/use-pan-zoom';
import type { LocalStatementPdf } from '../lib/local-pdf';
import type { StatementCandidate } from '../types';

interface StatementViewerProps {
  pdf: LocalStatementPdf | null;
  page: number;
  pageCount: number;
  visible: boolean;
  chosen: StatementCandidate | undefined;
  onPageChange: (page: number) => void;
  onError: (message: string) => void;
}

export function StatementViewer({
  pdf,
  page,
  pageCount,
  visible,
  chosen,
  onPageChange,
  onError,
}: StatementViewerProps) {
  const { hidden, canReveal, getHideEpoch } = useAmountVisibility();
  const canvas = useRef<HTMLCanvasElement>(null);
  const scrolledTo = useRef('');
  const { container, zoom, level, zoomIn, zoomOut, fit, handlers } =
    usePanZoom();
  const highlight = (chosen?.source ?? [])
    .filter((line) => line.page === page)
    .map((line) => line.line)
    .join(',');
  const factor = level.factor;

  useEffect(() => {
    const target = canvas.current;
    const box = container.current;
    if (hidden || !canReveal() || !pdf || !target || !pageCount) return;
    const hideEpoch = getHideEpoch();
    let active = true;
    const width = box?.clientWidth
      ? Math.round(box.clientWidth * factor * (window.devicePixelRatio || 1))
      : undefined;
    const lines = highlight ? highlight.split(',').map(Number) : [];
    pdf.render(page, target, { width, highlight: lines }).then(
      (band) => {
        const key = `${page}:${highlight}`;
        if (!active || !band || !box || zoom === 'fit') return;
        if (scrolledTo.current === key) return;
        scrolledTo.current = key;
        box.scrollTop = band.top * target.clientHeight - box.clientHeight / 3;
      },
      () => {
        if (active && canReveal() && getHideEpoch() === hideEpoch)
          onError(
            'This source page could not be rendered. Choose another file or clear the review.'
          );
      }
    );
    return () => {
      active = false;
    };
  }, [
    pdf,
    page,
    pageCount,
    visible,
    zoom,
    factor,
    highlight,
    hidden,
    canReveal,
    getHideEpoch,
    container,
    onError,
  ]);

  const zoomIndex = STATEMENT_ZOOM_LEVELS.findIndex(
    (entry) => entry.value === zoom
  );
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={hidden || page <= 1}
              onClick={() => canReveal() && onPageChange(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 text-sm tabular-nums">
              Page {page} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={hidden || page >= pageCount}
              onClick={() => canReveal() && onPageChange(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : (
          <span className="text-sm">Page {page}</span>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={hidden || zoomIndex <= 0}
            onClick={zoomOut}
          >
            <Minus />
          </Button>
          <span
            className="w-12 text-center text-sm tabular-nums"
            aria-live="polite"
          >
            {level.label}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={hidden || zoomIndex >= STATEMENT_ZOOM_LEVELS.length - 1}
            onClick={zoomIn}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={hidden || zoom === 'fit'}
            onClick={fit}
          >
            Fit
          </Button>
        </div>
      </div>
      {!hidden && chosen && chosen.source[0].page === page && (
        <details className="text-muted-foreground shrink-0 text-xs">
          <summary className="cursor-pointer">Source text</summary>
          <p
            className="max-h-20 overflow-y-auto py-2 break-words"
            aria-live="polite"
          >
            Source page {chosen.source[0].page}, line {chosen.source[0].line}:{' '}
            {chosen.source.map((line) => line.text).join(' ')}
          </p>
        </details>
      )}
      {!hidden && (
        <div
          ref={container}
          tabIndex={0}
          role="region"
          aria-label={`Statement page ${page} at ${level.label}. Plus and minus zoom, 0 fits the page.`}
          className={cn(
            'bg-muted/30 focus-visible:ring-ring min-h-0 flex-1 touch-none overflow-auto rounded-md border outline-none focus-visible:ring-2',
            zoom === 'fit'
              ? 'flex items-center justify-center'
              : 'cursor-grab active:cursor-grabbing'
          )}
          {...handlers}
        >
          <canvas
            ref={canvas}
            aria-label={`Original statement page ${page}`}
            className={cn('block select-none', level.className)}
          />
        </div>
      )}
    </>
  );
}

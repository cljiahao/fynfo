'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  OCR_DEADLINE_MS,
  OCR_RENDER_SCALE,
  STATEMENT_LIMITS,
} from '../constants';
import { renderScale } from '../lib/local-pdf';
import {
  formatOcrDumpLines,
  formatOcrDumpWords,
  type OcrDumpPage,
} from '../lib/ocr-dump-format';
import { loadTesseractRecognizer } from '../lib/statement-ocr';
import { ocrLinesToItems } from '../lib/statement-ocr-items';

const RESOURCE_ROOT = '/pdfjs/6.4.299/';

/** Every page is OCRed, even ones with a text layer, so the layout notes show
 * exactly what the recogniser sees. All work stays inside this tab. */
async function dumpPdf(
  bytes: ArrayBuffer,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onPage: (page: OcrDumpPage) => void
) {
  if (bytes.byteLength > STATEMENT_LIMITS.bytes)
    throw new Error('PDF exceeds the 10 MiB limit.');
  const pdfjs = await import('pdfjs-dist');
  if (signal.aborted) throw new Error('Cancelled');
  const port = new Worker(`${RESOURCE_ROOT}pdf.worker.mjs`, { type: 'module' });
  const worker = pdfjs.PDFWorker.create({ port });
  let loading: PDFDocumentLoadingTask | undefined;
  let terminate: (() => Promise<void>) | undefined;
  // tesseract.js never settles a pending recognize() once its worker is
  // terminated, so every await races this promise to fail on abort.
  const cancelled = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Cancelled')), {
      once: true,
    });
  });
  cancelled.catch(() => undefined);
  try {
    loading = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      worker,
      cMapUrl: `${RESOURCE_ROOT}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${RESOURCE_ROOT}standard_fonts/`,
      wasmUrl: `${RESOURCE_ROOT}wasm/`,
      enableXfa: false,
      stopAtErrors: true,
      maxImageSize: STATEMENT_LIMITS.pixels,
      canvasMaxAreaInBytes: STATEMENT_LIMITS.pixels * 4,
      useSystemFonts: true,
      verbosity: 0,
    });
    // No password is collected; a protected PDF fails instead of prompting.
    loading.onPassword = () => {
      void loading?.destroy();
    };
    const pdf = await Promise.race([loading.promise, cancelled]);
    if (pdf.numPages > STATEMENT_LIMITS.pages)
      throw new Error('Unsupported or oversized PDF');
    onStatus('loading OCR engine');
    const engine = loadTesseractRecognizer();
    const recognizer = await Promise.race([engine, cancelled]).catch(
      (error: unknown) => {
        // The engine may finish loading after a cancel; never leak it.
        void engine.then((late) => late.terminate()).catch(() => undefined);
        throw error;
      }
    );
    terminate = () => recognizer.terminate();
    for (let number = 1; number <= pdf.numPages; number++) {
      if (signal.aborted) throw new Error('Cancelled');
      const started = Date.now();
      const label = `page ${number}/${pdf.numPages}`;
      onStatus(`${label}: rendering`);
      const page = await Promise.race([pdf.getPage(number), cancelled]);
      const base = page.getViewport({ scale: 1 });
      const scale = renderScale(base, OCR_RENDER_SCALE);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      try {
        await Promise.race([
          page.render({
            canvas,
            viewport,
            annotationMode: pdfjs.AnnotationMode.DISABLE,
          }).promise,
          cancelled,
        ]);
        onStatus(`${label}: recognising`);
        const lines = await Promise.race([
          recognizer.recognize(canvas),
          cancelled,
        ]);
        onPage({
          page: number,
          pxWidth: canvas.width,
          pxHeight: canvas.height,
          widthPoints: base.width,
          heightPoints: base.height,
          items: ocrLinesToItems(lines, scale, base.height),
        });
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        onStatus(`${label}: done in ${seconds} s`);
      } finally {
        canvas.width = 0;
        page.cleanup();
      }
    }
  } finally {
    // Not awaited: a terminate that hangs must not keep the tab busy.
    void terminate?.().catch(() => undefined);
    void loading?.destroy().catch(() => undefined);
    worker.destroy();
    port.terminate();
  }
}

export function OcrDump() {
  const [pages, setPages] = useState<OcrDumpPage[]>([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mask, setMask] = useState(true);
  const [copied, setCopied] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const lines = useMemo(() => formatOcrDumpLines(pages, mask), [pages, mask]);
  const words = useMemo(() => formatOcrDumpWords(pages, mask), [pages, mask]);

  async function onFile(file: File | undefined) {
    controller.current?.abort();
    setPages([]);
    setError('');
    setCopied(false);
    if (!file) return;
    const run = new AbortController();
    controller.current = run;
    const current = () => controller.current === run && !run.signal.aborted;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      run.abort();
    }, OCR_DEADLINE_MS);
    let finishedPages = 0;
    let failed = false;
    setBusy(true);
    setStatus('reading file');
    try {
      await dumpPdf(
        await file.arrayBuffer(),
        run.signal,
        (next) => {
          if (current()) setStatus(next);
        },
        (page) => {
          finishedPages += 1;
          if (current()) setPages((existing) => [...existing, page]);
        }
      );
    } catch (failure) {
      failed = true;
      if (controller.current === run)
        setError(
          timedOut
            ? `OCR timed out after ${OCR_DEADLINE_MS / 1000} s`
            : failure instanceof Error
              ? failure.message
              : 'OCR failed.'
        );
    } finally {
      clearTimeout(timer);
      if (controller.current === run) {
        setStatus(
          failed
            ? 'idle'
            : `done: ${finishedPages} page${finishedPages === 1 ? '' : 's'}`
        );
        setBusy(false);
      }
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
    } catch {
      setError('Copy failed; select the text and copy it manually.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-semibold">OCR dump</h1>
      <p className="text-muted-foreground text-sm">
        Real statement data is shown here. Everything runs in this tab and
        nothing is sent anywhere. Redact names and merchants before sharing.
      </p>
      <div className="space-y-2">
        <Label htmlFor="ocr-dump-file">Statement PDF</Label>
        <Input
          id="ocr-dump-file"
          type="file"
          accept="application/pdf"
          disabled={busy}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="ocr-dump-mask"
          checked={mask}
          onCheckedChange={(value) => setMask(value === true)}
        />
        <Label htmlFor="ocr-dump-mask">Mask digits</Label>
      </div>
      <p aria-live="polite" className="text-sm">
        {status}
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Textarea
        readOnly
        aria-label="OCR lines"
        value={lines}
        className="min-h-64 font-mono text-xs"
      />
      <Button type="button" onClick={() => void copy()} disabled={!lines}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <details>
        <summary className="cursor-pointer text-sm">Raw word table</summary>
        <pre className="mt-2 overflow-x-auto text-xs">{words}</pre>
      </details>
    </div>
  );
}

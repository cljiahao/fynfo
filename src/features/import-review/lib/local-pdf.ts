import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from 'pdfjs-dist';
import { STATEMENT_LIMITS } from '../constants';
import type { StatementLine, StatementLineBox } from '../types';
import {
  positionedStatementLineBoxes,
  positionedStatementLines,
} from './statement-parser';

const RESOURCE_ROOT = '/pdfjs/6.4.299/';
export interface StatementRenderOptions {
  /** Target canvas width in device pixels; still capped by the render limits. */
  width?: number;
  /** Line numbers on this page to mark with a highlight band. */
  highlight?: number[];
}
/** Highlight band position as fractions of the canvas height. */
export interface StatementHighlightBand {
  top: number;
  bottom: number;
}
export interface LocalStatementPdf {
  pageCount: number;
  extract(): Promise<StatementLine[]>;
  render(
    page: number,
    canvas: HTMLCanvasElement,
    options?: StatementRenderOptions
  ): Promise<StatementHighlightBand | null>;
  destroy(): void;
}

/** Local bytes + same-origin resources only. No viewer, scripting, attachment,
 * annotation or link layer; no document URL or fallback remote resource fetch. */
export async function openLocalStatementPdf(
  bytes: ArrayBuffer,
  signal: AbortSignal
): Promise<LocalStatementPdf> {
  if (bytes.byteLength > STATEMENT_LIMITS.bytes)
    throw new Error('PDF exceeds the 10 MiB limit.');
  const pdfjs = await import('pdfjs-dist');
  if (signal.aborted) throw new Error('Cancelled');
  const port = new Worker(`${RESOURCE_ROOT}pdf.worker.mjs`, { type: 'module' });
  const worker = pdfjs.PDFWorker.create({ port });
  let loading: PDFDocumentLoadingTask | undefined;
  let document: PDFDocumentProxy | undefined;
  let renderTask: RenderTask | undefined;
  let active = true;
  let renderGeneration = 0;
  function destroy() {
    if (!active) return;
    active = false;
    renderGeneration++;
    renderTask?.cancel();
    void loading?.destroy().catch(() => undefined);
    worker.destroy();
    port.terminate();
    signal.removeEventListener('abort', destroy);
  }
  signal.addEventListener('abort', destroy, { once: true });
  const timer = setTimeout(destroy, STATEMENT_LIMITS.deadlineMs);
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
    // This batch collects no PDF password. Return one fixed, nonfinancial failure.
    loading.onPassword = () => {
      destroy();
    };
    document = await loading.promise;
    if (!active || document.numPages > STATEMENT_LIMITS.pages)
      throw new Error('Unsupported or oversized PDF');
    const pdf = document;
    const lineBoxes = new Map<number, StatementLineBox[]>();
    return {
      pageCount: pdf.numPages,
      async extract() {
        const deadline = setTimeout(destroy, STATEMENT_LIMITS.deadlineMs);
        try {
          let characters = 0;
          let itemCount = 0;
          const lines: StatementLine[] = [];
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            if (!active) throw new Error('Cancelled');
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            itemCount += content.items.length;
            const items = content.items.flatMap((item) =>
              'str' in item
                ? [
                    {
                      text: item.str,
                      x: item.transform[4],
                      y: item.transform[5],
                      height: item.height,
                    },
                  ]
                : []
            );
            characters += items.reduce(
              (sum, item) => sum + item.text.length,
              0
            );
            if (
              characters > STATEMENT_LIMITS.characters ||
              itemCount > STATEMENT_LIMITS.textItems
            )
              throw new Error('Statement text limit');
            lines.push(...positionedStatementLines(items, pageNumber));
            lineBoxes.set(pageNumber, positionedStatementLineBoxes(items));
            page.cleanup();
          }
          if (!active) throw new Error('Cancelled');
          return lines;
        } finally {
          clearTimeout(deadline);
        }
      },
      async render(pageNumber, canvas, options = {}) {
        if (!active || pageNumber < 1 || pageNumber > pdf.numPages)
          throw new Error('Cancelled');
        const currentRender = ++renderGeneration;
        renderTask?.cancel();
        const page = await pdf.getPage(pageNumber);
        if (!active || currentRender !== renderGeneration)
          throw new Error('Cancelled');
        const base = page.getViewport({ scale: 1 });
        if (
          !Number.isFinite(base.width) ||
          !Number.isFinite(base.height) ||
          base.width <= 0 ||
          base.height <= 0
        )
          throw new Error('Unsupported page dimensions');
        const requested =
          options.width && Number.isFinite(options.width) && options.width > 0
            ? options.width / base.width
            : 1.5;
        const scale = Math.min(
          requested,
          8192 / base.width,
          8192 / base.height,
          Math.sqrt(STATEMENT_LIMITS.pixels / (base.width * base.height))
        );
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const deadline = setTimeout(destroy, STATEMENT_LIMITS.deadlineMs);
        try {
          renderTask = page.render({
            canvas,
            viewport,
            annotationMode: pdfjs.AnnotationMode.DISABLE,
          });
          await renderTask.promise;
        } finally {
          clearTimeout(deadline);
        }
        const boxes = (options.highlight ?? []).flatMap((line) => {
          const box = lineBoxes.get(pageNumber)?.[line - 1];
          return box ? [box] : [];
        });
        if (!boxes.length || !canvas.height) return null;
        // PDF space is y-up; pad below the baseline for descenders.
        const edges = boxes.flatMap((box) => {
          const height = Math.max(box.height, 8);
          return [
            viewport.convertToViewportPoint(0, box.y - height * 0.3)[1],
            viewport.convertToViewportPoint(0, box.y + height)[1],
          ];
        });
        const top = Math.max(0, Math.min(...edges) - 2);
        const bottom = Math.min(canvas.height, Math.max(...edges) + 2);
        const context = canvas.getContext('2d');
        const color = getComputedStyle(canvas)
          .getPropertyValue('--brand')
          .trim();
        if (context && color) {
          context.save();
          context.fillStyle = color;
          context.globalAlpha = 0.18;
          context.fillRect(0, top, canvas.width, bottom - top);
          context.globalAlpha = 0.9;
          context.fillRect(
            0,
            top,
            Math.max(3, canvas.width / 200),
            bottom - top
          );
          context.restore();
        }
        return { top: top / canvas.height, bottom: bottom / canvas.height };
      },
      destroy,
    };
  } catch {
    destroy();
    throw new Error(
      'PDF could not be opened. Use an unprotected text PDF, at most 10 MiB and 100 pages.'
    );
  } finally {
    clearTimeout(timer);
  }
}

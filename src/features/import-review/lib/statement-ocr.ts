import type { PositionedStatementText } from '../types';
import { ocrWordsToItems, type OcrWord } from './statement-ocr-items';

/** Same-origin copy made by `scripts/copy-ocr-assets.mjs`; nothing is fetched
 * from a CDN, so statement pixels and text never leave the browser. */
export const OCR_RESOURCE_ROOT = '/ocr/7.0.0/';

export interface OcrRecognizer {
  recognize(image: HTMLCanvasElement): Promise<OcrWord[]>;
  terminate(): Promise<void>;
}

export interface OcrPageImage {
  canvas: HTMLCanvasElement;
  /** Canvas pixels per PDF point. */
  scale: number;
  heightPoints: number;
}

export interface OcrStatementPagesOptions {
  pageCount: number;
  renderPage(page: number): Promise<OcrPageImage>;
  /** Injected so tests never load the engine. */
  recognizer: OcrRecognizer;
  isActive(): boolean;
  onProgress?(page: number, total: number): void;
}

/** Pages run one at a time: a single worker keeps memory flat on phones. */
export async function ocrStatementPages({
  pageCount,
  renderPage,
  recognizer,
  isActive,
  onProgress,
}: OcrStatementPagesOptions): Promise<PositionedStatementText[][]> {
  const pages: PositionedStatementText[][] = [];
  for (let page = 1; page <= pageCount; page++) {
    if (!isActive()) throw new Error('Cancelled');
    onProgress?.(page, pageCount);
    const image = await renderPage(page);
    try {
      const words = await recognizer.recognize(image.canvas);
      if (!isActive()) throw new Error('Cancelled');
      pages.push(ocrWordsToItems(words, image.scale, image.heightPoints));
    } finally {
      image.canvas.width = 0;
    }
  }
  return pages;
}

/** The engine is imported only here, so text-PDF imports never download it. */
export async function loadTesseractRecognizer(): Promise<OcrRecognizer> {
  const { createWorker, OEM } = await import('tesseract.js');
  // Explicit same-origin paths keep the engine's default CDN URLs unreachable. `workerBlobURL: false` loads the worker straight from `/ocr/`
  // because a blob worker's importScripts is blocked by `strict-dynamic`.
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${OCR_RESOURCE_ROOT}worker.js`,
    corePath: `${OCR_RESOURCE_ROOT}core`,
    langPath: `${OCR_RESOURCE_ROOT}lang`,
    cacheMethod: 'none',
    workerBlobURL: false,
    gzip: true,
  });
  return {
    async recognize(image) {
      const { data } = await worker.recognize(image, {}, { blocks: true });
      return (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.flatMap((line) =>
            line.words.map((word) => ({
              text: word.text,
              confidence: word.confidence,
              bbox: word.bbox,
            }))
          )
        )
      );
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

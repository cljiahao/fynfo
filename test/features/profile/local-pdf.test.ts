// @vitest-environment jsdom
import { STATEMENT_LIMITS } from '@/features/import-review/constants';
import { openLocalStatementPdf } from '@/features/import-review/lib/local-pdf';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  workerDestroy: vi.fn(),
  terminate: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('pdfjs-dist', () => ({
  PDFWorker: { create: () => ({ destroy: mocks.workerDestroy }) },
  getDocument: mocks.getDocument,
  AnnotationMode: { DISABLE: 0 },
}));
let document: { numPages: number; getPage: ReturnType<typeof vi.fn> };
let loading: {
  promise: Promise<typeof document>;
  destroy: ReturnType<typeof vi.fn>;
  onPassword?: () => void;
};
let page: {
  getTextContent: ReturnType<typeof vi.fn>;
  cleanup: ReturnType<typeof vi.fn>;
  getViewport: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'Worker',
    class {
      terminate = mocks.terminate;
    }
  );
  page = {
    getTextContent: vi.fn(async () => ({
      items: [
        { str: 'UOB', transform: [1, 0, 0, 1, 10, 200] },
        { str: 'SGD 2.00', transform: [1, 0, 0, 1, 100, 200] },
      ],
    })),
    cleanup: vi.fn(),
    getViewport: vi.fn(({ scale }) => ({
      width: 600 * scale,
      height: 800 * scale,
    })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: mocks.cancel })),
  };
  document = { numPages: 2, getPage: vi.fn(async () => page) };
  loading = {
    promise: Promise.resolve(document),
    destroy: vi.fn(async () => undefined),
  };
  mocks.getDocument.mockImplementation(() => loading);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('uses local bytes/resources and disables annotations while extracting positioned provenance', async () => {
  const bytes = new ArrayBuffer(4);
  const session = await openLocalStatementPdf(
    bytes,
    new AbortController().signal
  );
  expect(mocks.getDocument).toHaveBeenCalledWith(
    expect.objectContaining({
      data: new Uint8Array(bytes),
      enableXfa: false,
      cMapUrl: '/pdfjs/6.4.299/cmaps/',
    })
  );
  expect(await session.extract()).toEqual([
    { page: 1, line: 1, text: 'UOB SGD 2.00' },
    { page: 2, line: 1, text: 'UOB SGD 2.00' },
  ]);
  const canvas = globalThis.document.createElement('canvas');
  await session.render(1, canvas);
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(
    STATEMENT_LIMITS.pixels
  );
  expect(page.render).toHaveBeenCalledWith(
    expect.objectContaining({ annotationMode: 0 })
  );
  session.destroy();
  session.destroy();
  expect(mocks.terminate).toHaveBeenCalledTimes(1);
  expect(loading.destroy).toHaveBeenCalledTimes(1);
});
it('rejects oversized bytes and aborted opens before starting a worker', async () => {
  await expect(
    openLocalStatementPdf(
      new ArrayBuffer(STATEMENT_LIMITS.bytes + 1),
      new AbortController().signal
    )
  ).rejects.toThrow();
  const controller = new AbortController();
  controller.abort();
  await expect(
    openLocalStatementPdf(new ArrayBuffer(4), controller.signal)
  ).rejects.toThrow();
  expect(mocks.getDocument).not.toHaveBeenCalled();
});
it('destroys documents exceeding the page cap', async () => {
  document.numPages = 101;
  await expect(
    openLocalStatementPdf(new ArrayBuffer(4), new AbortController().signal)
  ).rejects.toThrow(/could not be opened/);
  expect(mocks.terminate).toHaveBeenCalled();
});
it('cancels active sessions and refuses further rendering/extraction', async () => {
  const controller = new AbortController();
  const session = await openLocalStatementPdf(
    new ArrayBuffer(4),
    controller.signal
  );
  await session.render(1, globalThis.document.createElement('canvas'));
  controller.abort();
  expect(mocks.cancel).toHaveBeenCalled();
  await expect(session.extract()).rejects.toThrow('Cancelled');
  await expect(
    session.render(1, globalThis.document.createElement('canvas'))
  ).rejects.toThrow('Cancelled');
});
it('enforces extracted text bounds', async () => {
  page.getTextContent.mockResolvedValue({
    items: [
      {
        str: 'x'.repeat(STATEMENT_LIMITS.characters + 1),
        transform: [1, 0, 0, 1, 1, 1],
      },
    ],
  });
  const session = await openLocalStatementPdf(
    new ArrayBuffer(4),
    new AbortController().signal
  );
  await expect(session.extract()).rejects.toThrow('Statement text limit');
  session.destroy();
});
it('rejects invalid page dimensions and invalid page numbers', async () => {
  const session = await openLocalStatementPdf(
    new ArrayBuffer(4),
    new AbortController().signal
  );
  page.getViewport.mockReturnValue({ width: Infinity, height: 0 });
  await expect(
    session.render(1, globalThis.document.createElement('canvas'))
  ).rejects.toThrow('dimensions');
  await expect(
    session.render(0, globalThis.document.createElement('canvas'))
  ).rejects.toThrow();
  session.destroy();
});
it('destroys password-required documents without collecting a password', async () => {
  let reject!: (reason: Error) => void;
  loading.promise = new Promise((_resolve, fail) => {
    reject = fail;
  });
  loading.destroy.mockImplementation(async () => {
    reject(new Error('Password required'));
  });
  const result = openLocalStatementPdf(
    new ArrayBuffer(4),
    new AbortController().signal
  );
  const rejected = expect(result).rejects.toThrow(/could not be opened/);
  await vi.waitFor(() => expect(loading.onPassword).toBeDefined());
  loading.onPassword!();
  await rejected;
  expect(mocks.terminate).toHaveBeenCalled();
});
it('terminates a stalled open at the operation deadline', async () => {
  vi.useFakeTimers();
  let reject!: (reason: Error) => void;
  loading.promise = new Promise((_resolve, fail) => {
    reject = fail;
  });
  loading.destroy.mockImplementation(async () => {
    reject(new Error('Destroyed'));
  });
  const result = openLocalStatementPdf(
    new ArrayBuffer(4),
    new AbortController().signal
  );
  const rejected = expect(result).rejects.toThrow(/could not be opened/);
  await vi.advanceTimersByTimeAsync(STATEMENT_LIMITS.deadlineMs);
  await rejected;
  expect(mocks.terminate).toHaveBeenCalledTimes(1);
});
it('renders at a requested width within limits and paints a highlight band over source lines', async () => {
  page.getViewport.mockImplementation(({ scale }) => ({
    width: 600 * scale,
    height: 800 * scale,
    convertToViewportPoint: (x: number, y: number) => [
      x * scale,
      (800 - y) * scale,
    ],
  }));
  page.getTextContent.mockResolvedValue({
    items: [
      { str: 'HEADER', transform: [1, 0, 0, 1, 10, 700], height: 10 },
      { str: '01 OCT SHOP 2.00', transform: [1, 0, 0, 1, 10, 400], height: 10 },
    ],
  });
  const session = await openLocalStatementPdf(
    new ArrayBuffer(4),
    new AbortController().signal
  );
  await session.extract();
  const fillRect = vi.fn();
  const canvas = globalThis.document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue({
    save: vi.fn(),
    restore: vi.fn(),
    fillRect,
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: () => 'oklch(0.55 0.13 240)',
  } as unknown as CSSStyleDeclaration);
  const band = await session.render(1, canvas, { width: 1200, highlight: [2] });
  expect(canvas.width).toBe(1200);
  expect(band).toEqual({ top: 778 / 1600, bottom: 808 / 1600 });
  expect(fillRect).toHaveBeenCalledWith(0, 778, 1200, 30);
  expect(await session.render(1, canvas, { highlight: [9] })).toBeNull();
  await session.render(1, canvas, { width: 1_000_000 });
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(
    STATEMENT_LIMITS.pixels
  );
  session.destroy();
});
it('renders off-screen and leaves the visible canvas alone when superseded', async () => {
  let finishFirst = () => {};
  page.render
    .mockImplementationOnce(() => ({
      promise: new Promise<void>((resolve) => {
        finishFirst = resolve;
      }),
      cancel: mocks.cancel,
    }))
    .mockImplementation(() => ({
      promise: Promise.resolve(),
      cancel: mocks.cancel,
    }));
  const session = await openLocalStatementPdf(
    new ArrayBuffer(4),
    new AbortController().signal
  );
  const canvas = globalThis.document.createElement('canvas');
  const drawImage = vi.fn();
  vi.spyOn(canvas, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const first = session.render(1, canvas, { width: 600 });
  await vi.waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
  expect(page.render.mock.calls[0][0].canvas).not.toBe(canvas);
  expect(canvas.width).toBe(300);
  await session.render(2, canvas, { width: 900 });
  finishFirst();
  await expect(first).rejects.toThrow('Cancelled');
  expect(canvas.width).toBe(900);
  expect(drawImage).toHaveBeenCalledTimes(1);
  session.destroy();
});

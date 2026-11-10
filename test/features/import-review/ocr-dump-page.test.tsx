import { afterEach, expect, it, vi } from 'vitest';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
);
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/features/import-review', async () => ({
  OcrDump: () => null,
  isOcrDumpEnabled: (
    await import('@/features/import-review/lib/ocr-dump-format')
  ).isOcrDumpEnabled,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

it('returns 404 outside development', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const { default: Page } = await import('@/app/dev/ocr-dump/page');
  expect(() => Page()).toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalled();
});

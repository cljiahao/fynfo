import { afterEach, expect, it, vi } from 'vitest';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
);
vi.mock('next/navigation', () => ({ notFound }));
const OcrDump = vi.hoisted(() => () => null);
// Stubbing NODE_ENV flips the JSX transform to the dev runtime, which the
// production React build in vitest does not provide.
vi.mock('react/jsx-dev-runtime', () => ({
  Fragment: Symbol('fragment'),
  jsxDEV: (type: unknown, props: unknown) => ({ type, props }),
}));
vi.mock('@/features/import-review', async () => ({
  OcrDump,
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

it('renders the dump component in development', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const { default: Page } = await import('@/app/dev/ocr-dump/page');
  expect(Page()).toMatchObject({ type: OcrDump });
  expect(notFound).not.toHaveBeenCalled();
});

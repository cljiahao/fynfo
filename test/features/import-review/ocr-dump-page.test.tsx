import { afterEach, expect, it, vi } from 'vitest';

const gate = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const OcrDump = vi.hoisted(() => () => null);
vi.mock('@/features/admin', () => gate);
vi.mock('@/features/import-review', () => ({ OcrDump }));

afterEach(() => gate.requireAdmin.mockReset());

it('returns 404 for a non-admin', async () => {
  gate.requireAdmin.mockRejectedValue(new Error('NEXT_NOT_FOUND'));
  const { default: Page } = await import('@/app/dashboard/admin/ocr-dump/page');
  await expect(Page()).rejects.toThrow('NEXT_NOT_FOUND');
});

it('renders the dump component for an admin', async () => {
  gate.requireAdmin.mockResolvedValue(undefined);
  const { default: Page } = await import('@/app/dashboard/admin/ocr-dump/page');
  expect(await Page()).toMatchObject({ type: OcrDump });
});

// @vitest-environment jsdom
import { ExportReview } from '@/features/profile/components/export-review';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

const fixture = readFileSync(
  resolve('docs/audit/pdf-import-fixtures/export-v3-synthetic.json'),
  'utf8'
);
afterEach(cleanup);
function fileWith(read: () => Promise<string>, size = fixture.length) {
  const file = new File([''], 'synthetic.json', { type: 'application/json' });
  Object.defineProperty(file, 'size', { value: size });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => {
      const content = await read();
      return new TextEncoder().encode(content).buffer;
    },
  });
  return file;
}
function choose(file: File) {
  fireEvent.change(screen.getByLabelText('Fynfo JSON export'), {
    target: { files: [file] },
  });
}

it('reviews locally with visible limitations and nine domain counts, without financial rows', async () => {
  render(<ExportReview />);
  choose(fileWith(async () => fixture));
  expect(
    await screen.findByText(
      'Supported format, version 3. No records were changed.'
    )
  ).toBeVisible();
  expect(screen.getByText('Saved planning scenarios')).toBeVisible();
  expect(screen.getByText(/Nothing is uploaded or saved/)).toBeVisible();
  expect(screen.queryByText('Synthetic market')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /save|restore|import/i })
  ).not.toBeInTheDocument();
});
it('clears summary and returns keyboard focus to selection; same file can be selected again', async () => {
  render(<ExportReview />);
  const file = fileWith(async () => fixture);
  choose(file);
  await screen.findByText(/Supported format/);
  fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
  expect(screen.queryByText(/Supported format/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Fynfo JSON export')).toHaveFocus();
  expect(screen.getByLabelText('Fynfo JSON export')).toHaveValue('');
  choose(file);
  expect(await screen.findByText(/Supported format/)).toBeVisible();
});
it('rejects oversized file before reading', async () => {
  const read = vi.fn(async () => fixture);
  render(<ExportReview />);
  choose(fileWith(read, 1024 * 1024 + 1));
  expect(screen.getByText(/exceeds the 1 MiB/)).toBeVisible();
  expect(read).not.toHaveBeenCalled();
});
it('rejects malformed UTF-8 instead of silently replacing file bytes', async () => {
  const file = new File([''], 'synthetic.json');
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new Uint8Array([0xff]).buffer,
  });
  render(<ExportReview />);
  choose(file);
  expect(
    await screen.findByText(/file could not be read as UTF-8/)
  ).toBeVisible();
});
it('reports opaque read failures and allows retry', async () => {
  render(<ExportReview />);
  choose(
    fileWith(async () => {
      throw new Error('SYNTHETIC-PRIVATE-DIAGNOSTIC');
    })
  );
  expect(await screen.findByText(/file could not be read/)).toBeVisible();
  expect(screen.queryByText(/SYNTHETIC-PRIVATE/)).not.toBeInTheDocument();
  choose(fileWith(async () => fixture));
  expect(await screen.findByText(/Supported format/)).toBeVisible();
});
it('shows invalid format errors without retaining prior successful counts', async () => {
  render(<ExportReview />);
  choose(fileWith(async () => fixture));
  await screen.findByText(/Supported format/);
  choose(fileWith(async () => '{}'));
  expect(
    await screen.findByText(/does not match a supported Fynfo export/)
  ).toBeVisible();
  expect(
    screen.queryByText('Saved planning scenarios')
  ).not.toBeInTheDocument();
});
it('keeps legacy absence visible rather than calling missing scenarios zero', async () => {
  const legacy = JSON.parse(fixture) as {
    version: number;
    data: Record<string, unknown>;
  };
  legacy.version = 2;
  delete legacy.data.scenarios;
  render(<ExportReview />);
  choose(fileWith(async () => JSON.stringify(legacy)));
  expect(await screen.findAllByText('Not included')).toHaveLength(2);
  expect(
    screen.getByText(/Versions 1 and 2 do not include saved planning scenarios/)
  ).toBeVisible();
});
it.each(['replace', 'clear', 'unmount'] as const)(
  'discards late file results after %s',
  async (mode) => {
    let resolveRead!: (content: string) => void;
    const pending = new Promise<string>((resolvePromise) => {
      resolveRead = resolvePromise;
    });
    const view = render(<ExportReview />);
    choose(fileWith(() => pending));
    expect(screen.getByText(/Reading on this device/)).toBeVisible();
    if (mode === 'replace') {
      choose(fileWith(async () => '{}'));
      await screen.findByText(/does not match a supported Fynfo export/);
    } else if (mode === 'clear')
      fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
    else view.unmount();
    await act(async () => {
      resolveRead(fixture);
      await pending;
    });
    expect(screen.queryByText(/Supported format/)).not.toBeInTheDocument();
  }
);
it('discards late read errors after clear', async () => {
  let rejectRead!: (reason: Error) => void;
  const pending = new Promise<string>((_resolvePromise, rejectPromise) => {
    rejectRead = rejectPromise;
  });
  render(<ExportReview />);
  choose(fileWith(() => pending));
  fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
  await act(async () => {
    rejectRead(new Error('synthetic'));
    await pending.catch(() => undefined);
  });
  expect(screen.queryByText(/file could not be read/)).not.toBeInTheDocument();
});

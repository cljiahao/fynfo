// @vitest-environment jsdom
import {
  UndoableDeleteProvider,
  useUndoableDelete,
} from '@/features/household/hooks/use-undoable-delete';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toasts = vi.hoisted(() => ({
  toast: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(toasts.toast, {
    error: toasts.error,
    dismiss: toasts.dismiss,
  }),
}));

const DELAY = 6000;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <UndoableDeleteProvider delayMs={DELAY}>{children}</UndoableDeleteProvider>
  );
}

function setup(commit: () => Promise<void> = () => Promise.resolve()) {
  const hook = renderHook(() => useUndoableDelete(), { wrapper });
  const request = () =>
    hook.result.current.request({
      id: 'row-1',
      label: 'Entry',
      commit,
      errorMessage: 'Could not delete',
    });
  return { hook, request };
}

function undoAction(): () => void {
  const options = toasts.toast.mock.calls.at(-1)?.[1] as {
    action: { onClick: () => void };
  };
  return options.action.onClick;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useUndoableDelete', () => {
  it('throws without a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useUndoableDelete())).toThrow(
      /UndoableDeleteProvider/
    );
    spy.mockRestore();
  });

  it('hides the row and shows an Undo toast without committing', () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { hook, request } = setup(commit);
    act(request);
    expect(hook.result.current.pendingIds.has('row-1')).toBe(true);
    expect(toasts.toast).toHaveBeenCalledWith(
      'Entry',
      expect.objectContaining({
        duration: DELAY,
        action: expect.objectContaining({ label: 'Undo' }),
      })
    );
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits once after the window and releases the row when settled', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { hook, request } = setup(commit);
    act(request);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(hook.result.current.pendingIds.has('row-1')).toBe(false);
  });

  it('keeps the row hidden until the commit resolves', async () => {
    let resolve: () => void = () => undefined;
    const commit = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        })
    );
    const { hook, request } = setup(commit);
    act(request);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(hook.result.current.pendingIds.has('row-1')).toBe(true);
    await act(async () => {
      resolve();
    });
    expect(hook.result.current.pendingIds.has('row-1')).toBe(false);
  });

  it('Undo restores the row and never commits', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { hook, request } = setup(commit);
    act(request);
    act(() => undoAction()());
    expect(hook.result.current.pendingIds.has('row-1')).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY * 2);
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it('ignores a second request for a pending id', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { request } = setup(commit);
    act(request);
    act(request);
    expect(toasts.toast).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('restores the row and toasts when the commit fails', async () => {
    const commit = vi.fn().mockRejectedValue(new Error('boom'));
    const { hook, request } = setup(commit);
    act(request);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(toasts.error).toHaveBeenCalledWith('Could not delete');
    expect(hook.result.current.pendingIds.has('row-1')).toBe(false);
  });

  it('flushes the commit and dismisses the toast when the provider unmounts', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { hook, request } = setup(commit);
    act(request);
    hook.unmount();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(toasts.dismiss).toHaveBeenCalledWith('undo-delete-row-1');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('survives a consumer unmounting inside the window (tab switch)', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);

    function Consumer() {
      const { request } = useUndoableDelete();
      return (
        <button
          onClick={() =>
            request({
              id: 'row-1',
              label: 'Entry',
              commit,
              errorMessage: 'Could not delete',
            })
          }
        >
          delete
        </button>
      );
    }

    function Page() {
      const [tab, setTab] = useState<'spending' | 'goals'>('spending');
      return (
        <UndoableDeleteProvider delayMs={DELAY}>
          <button
            onClick={() => setTab(tab === 'goals' ? 'spending' : 'goals')}
          >
            switch
          </button>
          {tab === 'spending' ? <Consumer /> : null}
        </UndoableDeleteProvider>
      );
    }

    const view = render(<Page />);
    act(() => view.getByText('delete').click());
    act(() => view.getByText('switch').click());
    act(() => view.getByText('switch').click());
    expect(commit).not.toHaveBeenCalled();
    act(() => undoAction()());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(commit).not.toHaveBeenCalled();

    act(() => view.getByText('delete').click());
    act(() => view.getByText('switch').click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe('useUndoableDelete commit edge cases', () => {
  it('dismisses the toast when the window ends and a late Undo cannot stop the commit', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { request } = setup(commit);
    act(request);
    const undo = undoAction();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(toasts.dismiss).toHaveBeenCalledWith('undo-delete-row-1');
    act(() => undo());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('honours a non-default delayMs', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useUndoableDelete(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <UndoableDeleteProvider delayMs={1000}>
          {children}
        </UndoableDeleteProvider>
      ),
    });
    act(() =>
      hook.result.current.request({
        id: 'row-1',
        label: 'Entry',
        commit,
        errorMessage: 'Could not delete',
      })
    );
    expect(toasts.toast).toHaveBeenCalledWith(
      'Entry',
      expect.objectContaining({ duration: 1000 })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(commit).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('does not commit twice when an in-flight id is requested again', async () => {
    let resolve: () => void = () => undefined;
    const commit = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        })
    );
    const { request } = setup(commit);
    act(request);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY);
    });
    act(request);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY * 2);
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(toasts.toast).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
    });
  });

  it('toasts the error and does not throw when the unmount flush rejects', async () => {
    const commit = vi.fn().mockRejectedValue(new Error('boom'));
    const { hook, request } = setup(commit);
    act(request);
    expect(() => hook.unmount()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(toasts.error).toHaveBeenCalledWith('Could not delete');
  });
});

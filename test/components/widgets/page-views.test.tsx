// @vitest-environment jsdom
import { PageViews } from '@/components/widgets';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function Probe({ name, onMount }: { name: string; onMount: () => void }) {
  const [text, setText] = useState('');
  useEffect(onMount, [onMount]);
  return (
    <input
      aria-label={`${name} input`}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}

function setup(props: Partial<Parameters<typeof PageViews>[0]> = {}) {
  const mountA = vi.fn();
  const mountB = vi.fn();
  render(
    <PageViews
      label="Views"
      views={[
        { id: 'a', label: 'A', content: <Probe name="a" onMount={mountA} /> },
        { id: 'b', label: 'B', content: <Probe name="b" onMount={mountB} /> },
      ]}
      {...props}
    />
  );
  return { mountA, mountB };
}

describe('PageViews', () => {
  it('does not mount a tab until it is first selected', () => {
    const { mountA, mountB } = setup();
    expect(mountA).toHaveBeenCalledTimes(1);
    expect(mountB).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('b input')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(mountB).toHaveBeenCalledTimes(1);
  });

  it('keeps a visited tab mounted with its form state', () => {
    const { mountA } = setup();
    fireEvent.change(screen.getByLabelText('a input'), {
      target: { value: 'draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(screen.getByLabelText('a input')).toHaveValue('draft');
    expect(mountA).toHaveBeenCalledTimes(1);
  });

  it('keeps aria-controls pointing at an existing hidden shell', () => {
    setup();
    const button = screen.getByRole('button', { name: 'B' });
    const panel = document.getElementById(
      button.getAttribute('aria-controls') ?? ''
    );
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toBeEmptyDOMElement();
  });

  it('mounts a panel when a controlled value changes', () => {
    const mountB = vi.fn();
    const views = [
      { id: 'a', label: 'A', content: <span>a</span> },
      { id: 'b', label: 'B', content: <Probe name="b" onMount={mountB} /> },
    ];
    const { rerender } = render(
      <PageViews label="Views" value="a" views={views} />
    );
    expect(mountB).not.toHaveBeenCalled();
    rerender(<PageViews label="Views" value="b" views={views} />);
    expect(mountB).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('b input')).toBeVisible();
  });

  it('reports clicks through onValueChange', () => {
    const onValueChange = vi.fn();
    setup({ onValueChange });
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });
});

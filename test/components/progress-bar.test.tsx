// @vitest-environment jsdom
import { ProgressBar } from '@/components/widgets';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('ProgressBar', () => {
  it('draws one clamped, rounded segment without inline styles', () => {
    const { container } = render(
      <ProgressBar segments={[{ pct: 140, className: 'fill-gain' }]} />
    );
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('width')).toBe('100%');
    expect(rect?.getAttribute('class')).toBe('fill-gain');
    expect(rect?.getAttribute('rx')).toBe('4');
    expect(container.querySelector('[style]')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
  });

  it('stacks segments from the left and never overflows 100%', () => {
    const { container } = render(
      <ProgressBar
        segments={[
          { pct: 60, className: 'fill-primary' },
          { pct: 70, color: 'var(--cat-2)' },
        ]}
      />
    );
    const [first, second] = Array.from(container.querySelectorAll('rect'));
    expect(first.getAttribute('x')).toBe('0%');
    expect(second.getAttribute('x')).toBe('60%');
    expect(second.getAttribute('width')).toBe('40%');
    expect(second.getAttribute('fill')).toBe('var(--cat-2)');
  });

  it('clamps negative percentages to an empty bar', () => {
    const { container } = render(<ProgressBar segments={[{ pct: -5 }]} />);
    expect(container.querySelector('rect')?.getAttribute('width')).toBe('0%');
  });
});

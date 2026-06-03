// @vitest-environment jsdom
import { SiteFooter } from '@/components/layout/site-footer';
import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('SiteFooter', () => {
  it('tone="marketing" keeps the dark-always classes', () => {
    const { container } = render(<SiteFooter tone="marketing" />);
    const footer = container.querySelector('footer');
    expect(footer).toHaveClass('bg-black');
    expect(footer?.className).not.toContain('bg-card');
  });

  it('default (app) tone uses semantic tokens, not hardcoded black/white', () => {
    const { container } = render(<SiteFooter />);
    const footer = container.querySelector('footer');
    expect(footer).toHaveClass('bg-card');
    expect(footer?.className).not.toContain('bg-black');
    // text follows the theme rather than a hardcoded white
    expect(container.innerHTML).not.toContain('text-white');
  });
});

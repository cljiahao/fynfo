'use client';

import { Button } from '@/components/ui/button';
import { useId, useState, type ReactNode } from 'react';

/**
 * Mounts a panel only once its tab is first shown, so hidden tabs never run
 * their queries or measure charts at 0x0 on page load. Visited panels stay
 * mounted (hidden) so switching tasks never discards an unsaved form.
 */
export function PageViews({
  label,
  views,
  value,
  onValueChange,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  label: string;
  views: { id: string; label: string; content: ReactNode }[];
}) {
  const [internalSelected, setSelected] = useState(views[0]?.id);
  const selected = value ?? internalSelected;
  const [visited, setVisited] = useState<ReadonlySet<string | undefined>>(
    () => new Set([selected])
  );
  // Adjusting state during render lets a controlled value change mount the
  // panel in the same pass instead of flashing an empty shell first.
  if (!visited.has(selected)) setVisited(new Set(visited).add(selected));
  const id = useId();
  return (
    <div className="space-y-6">
      <div
        role="group"
        aria-label={label}
        className="flex flex-wrap gap-1 border-b pb-3"
      >
        {views.map((view) => (
          <Button
            key={view.id}
            id={`${id}-${view.id}-button`}
            type="button"
            variant={selected === view.id ? 'secondary' : 'ghost'}
            aria-pressed={selected === view.id}
            aria-controls={`${id}-${view.id}`}
            onClick={() => {
              setSelected(view.id);
              onValueChange?.(view.id);
            }}
          >
            {view.label}
          </Button>
        ))}
      </div>
      {views.map((view) => (
        <section
          key={view.id}
          id={`${id}-${view.id}`}
          aria-labelledby={`${id}-${view.id}-button`}
          hidden={selected !== view.id}
          className="space-y-6"
        >
          {(visited.has(view.id) || selected === view.id) && view.content}
        </section>
      ))}
    </div>
  );
}

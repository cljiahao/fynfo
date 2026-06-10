import { TrackEventSchema } from '@/lib/validation/track-event';
import { describe, expect, it } from 'vitest';

describe('TrackEventSchema', () => {
  it('accepts valid page_view and cta_click events', () => {
    expect(
      TrackEventSchema.safeParse({ eventType: 'page_view', path: '/' }).success
    ).toBe(true);
    expect(
      TrackEventSchema.safeParse({ eventType: 'cta_click', path: '/dashboard' })
        .success
    ).toBe(true);
  });

  it('rejects unknown event types', () => {
    expect(
      TrackEventSchema.safeParse({ eventType: 'signup', path: '/' }).success
    ).toBe(false);
    expect(
      TrackEventSchema.safeParse({ eventType: 'click', path: '/' }).success
    ).toBe(false);
  });

  it('rejects empty or over-length paths', () => {
    expect(
      TrackEventSchema.safeParse({ eventType: 'page_view', path: '' }).success
    ).toBe(false);
    expect(
      TrackEventSchema.safeParse({
        eventType: 'page_view',
        path: 'x'.repeat(129),
      }).success
    ).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(TrackEventSchema.safeParse({ path: '/' }).success).toBe(false);
    expect(TrackEventSchema.safeParse({ eventType: 'page_view' }).success).toBe(
      false
    );
  });
});

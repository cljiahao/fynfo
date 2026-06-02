import { loadLocal, saveLocal } from '@/lib/utils/local-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('local-store', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a value', () => {
    saveLocal('k', { a: 1 });
    expect(loadLocal('k', { a: 0 })).toEqual({ a: 1 });
  });

  it('returns the fallback for an absent key', () => {
    expect(loadLocal('missing', 42)).toBe(42);
  });

  it('returns the fallback on malformed JSON', () => {
    store.set('bad', '{not json');
    expect(loadLocal('bad', 'fb')).toBe('fb');
  });

  it('returns the fallback on the server (no window)', () => {
    vi.stubGlobal('window', undefined);
    expect(loadLocal('k', 'fb')).toBe('fb');
  });
});

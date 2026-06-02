import { isServerActionRequest } from '@/proxy';
import { describe, expect, it } from 'vitest';

const withAction = new Headers({ 'next-action': 'abc123' });
const plain = new Headers();

describe('isServerActionRequest', () => {
  it('is true only for a POST carrying the next-action header', () => {
    expect(isServerActionRequest('POST', withAction)).toBe(true);
  });

  it('is false for a GET even with the next-action header (RSC/nav stays protected)', () => {
    expect(isServerActionRequest('GET', withAction)).toBe(false);
  });

  it('is false for a POST without the header (fails secure → full proxy auth)', () => {
    expect(isServerActionRequest('POST', plain)).toBe(false);
  });

  it('is false for other methods', () => {
    expect(isServerActionRequest('PUT', withAction)).toBe(false);
    expect(isServerActionRequest('DELETE', withAction)).toBe(false);
  });
});

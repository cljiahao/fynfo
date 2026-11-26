import { buildMemberLabels } from '@/features/household/member-labels';
import { describe, expect, it } from 'vitest';

describe('buildMemberLabels', () => {
  const roster = ['c', 'a', 'me', 'b'];

  it('labels the caller You and numbers the others by sorted id', () => {
    const labels = buildMemberLabels(roster, 'me');
    expect(labels.label('me')).toBe('You');
    expect(labels.label('a')).toBe('Member 1');
    expect(labels.label('b')).toBe('Member 2');
    expect(labels.label('c')).toBe('Member 3');
  });

  it('keeps numbering stable whatever order the roster arrives in', () => {
    const one = buildMemberLabels(['a', 'b', 'me'], 'me');
    const two = buildMemberLabels(['me', 'b', 'a'], 'me');
    expect(one.label('b')).toBe(two.label('b'));
  });

  it('prefers a supplied display name', () => {
    const labels = buildMemberLabels(roster, 'me', { a: ' Sam Lee ' });
    expect(labels.label('a')).toBe('Sam Lee');
    expect(labels.initials('a')).toBe('SL');
    expect(labels.label('b')).toBe('Member 2');
  });

  it('falls back to Member for an id outside the roster', () => {
    expect(buildMemberLabels(roster, 'me').label('zzz')).toBe('Member');
  });

  it('gives the caller the first colour and others the rest', () => {
    const labels = buildMemberLabels(roster, 'me');
    expect(labels.colorIndex('me')).toBe(0);
    expect([labels.colorIndex('a'), labels.colorIndex('c')]).toEqual([1, 3]);
  });

  it('derives initials', () => {
    const labels = buildMemberLabels(roster, 'me');
    expect(labels.initials('me')).toBe('Y');
    expect(labels.initials('b')).toBe('M2');
  });
});

import { buildMemberLabels } from '@/features/household/member-labels';
import { describe, expect, it } from 'vitest';

describe('buildMemberLabels', () => {
  const roster = ['c', 'a', 'me', 'b'];

  it('labels the caller You and numbers the rest by roster position', () => {
    const labels = buildMemberLabels(roster, 'me');
    expect(labels.label('me')).toBe('You');
    expect(labels.label('a')).toBe('Member 1');
    expect(labels.label('b')).toBe('Member 2');
    expect(labels.label('c')).toBe('Member 3');
  });

  it('gives a member the same number and colour for every viewer', () => {
    const asMe = buildMemberLabels(roster, 'me');
    const asA = buildMemberLabels(roster, 'a');
    expect(asA.label('b')).toBe(asMe.label('b'));
    expect(asA.colorIndex('b')).toBe(asMe.colorIndex('b'));
    expect(asA.colorIndex('me')).toBe(asMe.colorIndex('me'));
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

  it('colours by roster position and uses a neutral slot off the roster', () => {
    const labels = buildMemberLabels(roster, 'me');
    expect([
      labels.colorIndex('a'),
      labels.colorIndex('b'),
      labels.colorIndex('c'),
      labels.colorIndex('me'),
    ]).toEqual([0, 1, 2, 3]);
    expect(labels.colorIndex('zzz')).toBe(4);
  });

  it('derives initials', () => {
    const labels = buildMemberLabels(roster, 'me');
    expect(labels.initials('me')).toBe('Y');
    expect(labels.initials('b')).toBe('M2');
  });
});

/**
 * Display labels for household members. The roster carries user ids only, so a
 * member shows as "Member N" unless a name is supplied; the caller is always
 * "You". Numbers and colours follow each user's position in the sorted roster,
 * the same for every viewer, so one person is the same Member N to everyone
 * (the caller keeps their number, so another member's number can skip it) and a
 * label never shifts when someone joins a goal.
 */
export type MemberNames = Readonly<Record<string, string | undefined>>;

export interface MemberLabels {
  label: (userId: string) => string;
  initials: (userId: string) => string;
  /** Palette slot by roster position; the last slot is neutral for ids off the roster. */
  colorIndex: (userId: string) => number;
}

const NEUTRAL_COLOR = 4;

export function buildMemberLabels(
  rosterIds: readonly string[],
  selfId: string | undefined,
  names: MemberNames = {}
): MemberLabels {
  const roster = [...new Set(rosterIds)].sort();
  const label = (userId: string): string => {
    if (userId === selfId) return 'You';
    const name = names[userId]?.trim();
    if (name) return name;
    const index = roster.indexOf(userId);
    return index === -1 ? 'Member' : `Member ${index + 1}`;
  };
  const initials = (userId: string): string => {
    if (userId === selfId) return 'Y';
    const text = label(userId);
    if (text === 'Member') return 'M';
    if (/^Member \d+$/.test(text)) return `M${text.slice(7)}`;
    return text
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
  };
  const colorIndex = (userId: string): number => {
    const index = roster.indexOf(userId);
    return index === -1 ? NEUTRAL_COLOR : index % NEUTRAL_COLOR;
  };
  return { label, initials, colorIndex };
}

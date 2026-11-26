/**
 * Display labels for household members. The roster carries user ids only, so a
 * member shows as "Member N" unless a name is supplied; the caller is always
 * "You". Numbering follows sorted user ids so every viewer agrees on who is
 * Member 1 and a label never shifts when someone joins a goal.
 */
export type MemberNames = Readonly<Record<string, string | undefined>>;

export interface MemberLabels {
  label: (userId: string) => string;
  initials: (userId: string) => string;
  /** Palette slot: the caller is 0, others follow in label order. */
  colorIndex: (userId: string) => number;
}

export function buildMemberLabels(
  rosterIds: readonly string[],
  selfId: string | undefined,
  names: MemberNames = {}
): MemberLabels {
  const others = [...new Set(rosterIds)].filter((id) => id !== selfId).sort();
  const label = (userId: string): string => {
    if (userId === selfId) return 'You';
    const name = names[userId]?.trim();
    if (name) return name;
    const index = others.indexOf(userId);
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
    if (userId === selfId) return 0;
    const index = others.indexOf(userId);
    return index === -1 ? 0 : (index + 1) % 4;
  };
  return { label, initials, colorIndex };
}

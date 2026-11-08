import type { StatementLine } from '../../types';

export const DATE_PREFIX =
  /^(\d{1,2})(?:[ /-](\d{1,2})|\s+([A-Za-z]{3,9}))(?:[ /-](\d{4}))?\s+/;
export const MONEY =
  /(?:SGD|S\$|USD|US\$|\$)?\s*[+-]?\(?\d[\d,.]*\.\d+\)?(?:\s*(?:CR|DR))?/gi;

// The exported MONEY is global for matchAll; a sticky-state-free copy is needed
// for plain presence checks.
const MONEY_PRESENT = new RegExp(MONEY.source, 'i');

const NON_ROW_HEADING =
  /^(?:OPENING BALANCE|CLOSING BALANCE|TOTAL BALANCE|TOTAL\b|TRANSACTION DATE|STATEMENT PERIOD|DESCRIPTION\b|SYNTHETIC\b)/i;

/** Dated lines start a row; undated lines continue the previous row on the same
 * page when it has no amount yet or when `continues` accepts them. */
export function groupDateRows(
  lines: StatementLine[],
  continues: (text: string) => boolean = () => false
): StatementLine[][] {
  const groups: StatementLine[][] = [];
  for (const line of lines) {
    if (NON_ROW_HEADING.test(line.text) && !DATE_PREFIX.test(line.text))
      continue;
    if (DATE_PREFIX.test(line.text)) groups.push([line]);
    else {
      const preceding = groups.at(-1);
      if (
        preceding &&
        preceding[0].page === line.page &&
        (!MONEY_PRESENT.test(preceding.map((item) => item.text).join(' ')) ||
          continues(line.text.trim())) &&
        line.text.trim()
      )
        preceding.push(line);
    }
  }
  return groups;
}

import { groupDateRows } from './patterns';
import type { StatementLayout } from './types';

const HEADER =
  /Post(?: Date)? Trans(?: Date)? Description of Transaction Transaction Amount(?: Date Date)? SGD\b/i;
const CONTINUATION = /^(?:Ref\s*No\s*:|[A-Z]{3}\s+[\d,.]+(?:\s*(?:CR|DR))?$)/i;

export const uobLayout: StatementLayout = {
  detect(lines) {
    const pages = new Set<number>();
    for (const page of new Set(lines.map((line) => line.page))) {
      const pageText = lines
        .filter((line) => line.page === page)
        .map((line) => line.text)
        .join(' ')
        .replace(/\s+/g, ' ');
      // PDF text can place both "Date" labels on a second header line.
      if (HEADER.test(pageText)) pages.add(page);
    }
    return pages;
  },
  groupRows(lines, claimedPages) {
    return groupDateRows(
      lines.filter((line) => claimedPages.has(line.page)),
      (text) => CONTINUATION.test(text)
    );
  },
  columns: { billedSgd: true, twoDate: true },
};

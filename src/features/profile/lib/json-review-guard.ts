import { EXPORT_REVIEW_MAX_DEPTH } from './export-review-constants';

/** JSON.parse cannot detect overwritten object members. Scan strings and container
 * boundaries first; JSON.parse remains responsible for the complete grammar. */
export function guardReviewJson(text: string): void {
  const stack: { keys: Set<string> | null; expectsKey: boolean }[] = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      const start = index++;
      for (; index < text.length; index++) {
        if (text[index] === '\\') index++;
        else if (text[index] === '"') break;
      }
      const container = stack.at(-1);
      if (container?.keys && container.expectsKey) {
        const key: unknown = JSON.parse(text.slice(start, index + 1));
        if (typeof key !== 'string' || container.keys.has(key))
          throw new Error('Ambiguous JSON');
        container.keys.add(key);
        container.expectsKey = false;
      }
    } else if (char === '{' || char === '[') {
      stack.push({ keys: char === '{' ? new Set() : null, expectsKey: true });
      if (stack.length > EXPORT_REVIEW_MAX_DEPTH)
        throw new Error('JSON nesting limit');
    } else if (char === '}' || char === ']') {
      stack.pop();
    } else if (char === ',') {
      const container = stack.at(-1);
      if (container?.keys) container.expectsKey = true;
    }
  }
}

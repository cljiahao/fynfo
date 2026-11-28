import { API_V1_SCHEMAS } from '@/lib/api-v1/schemas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Regenerate with: UPDATE_API_SCHEMAS=1 pnpm vitest run test/api/v1/invest-api-schemas.test.ts
const DIR = join(process.cwd(), 'docs', 'api', 'v1');

function render(schema: z.ZodType): string {
  return `${JSON.stringify(z.toJSONSchema(schema), null, 2)}\n`;
}

describe('published JSON schemas', () => {
  it.each(Object.entries(API_V1_SCHEMAS))(
    'docs/api/v1/%s.schema.json matches the Zod schema',
    async (name, schema) => {
      const path = join(DIR, `${name}.schema.json`);
      if (process.env.UPDATE_API_SCHEMAS === '1') {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(path, render(schema));
      }
      // Compare parsed JSON: prettier reflows the committed files, so byte
      // equality would fail on whitespace alone.
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(
        JSON.parse(render(schema))
      );
    }
  );
});

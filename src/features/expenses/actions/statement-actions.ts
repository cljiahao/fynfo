'use server';

import { requireUserId } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { parseStatement, type ParsedExpenseRow } from '../lib/statement-parser';

export async function processStatement(
  formData: FormData
): Promise<{ rows: ParsedExpenseRow[]; error?: string }> {
  await requireUserId();

  const file = formData.get('file') as File | null;
  if (!file) {
    return { rows: [], error: 'No file provided' };
  }

  const ext = file.name.toLowerCase().split('.').pop();
  if (ext !== 'csv') {
    return { rows: [], error: 'Only CSV files are supported' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = parseStatement(buffer, file.name);

    if (result.rows.length === 0) {
      return {
        ...result,
        error:
          'Could not parse the statement. Please upload a CSV with clear column headers (date, description, amount).',
      };
    }

    return result;
  } catch (e) {
    logger.error({ err: e, fileName: file.name }, 'statement parse failed');
    return {
      rows: [],
      error: e instanceof Error ? e.message : 'Failed to process statement',
    };
  }
}

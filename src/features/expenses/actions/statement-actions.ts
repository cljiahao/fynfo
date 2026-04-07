'use server';

import { requireUserId } from '@/lib/auth-guard';
import { parseStatement, type ParsedExpenseRow } from '../lib/statement-parser';

export async function processStatement(
  formData: FormData
): Promise<{ rows: ParsedExpenseRow[]; usedAi: boolean; error?: string }> {
  await requireUserId();

  const file = formData.get('file') as File | null;
  if (!file) {
    return { rows: [], usedAi: false, error: 'No file provided' };
  }

  const ext = file.name.toLowerCase().split('.').pop();
  if (ext !== 'pdf' && ext !== 'csv') {
    return { rows: [], usedAi: false, error: 'Only PDF and CSV files are supported' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parseStatement(buffer, file.name);

    if (result.rows.length === 0) {
      return {
        ...result,
        error: result.usedAi
          ? 'AI could not extract transactions from this statement. Try a different format.'
          : 'Could not parse the statement. Please ensure Ollama is running (ollama serve) or upload a CSV with clear column headers.',
      };
    }

    return result;
  } catch (e) {
    return {
      rows: [],
      usedAi: false,
      error: e instanceof Error ? e.message : 'Failed to process statement',
    };
  }
}

import Papa from 'papaparse';
import { EXPENSE_TYPES } from '../constants';
import type { ExpenseType } from '../types';
import { isOllamaAvailable, queryOllama } from './ollama';

export interface ParsedExpenseRow {
  date: string; // yyyy-MM-dd
  type: ExpenseType;
  item: string;
  info: string;
  amount: number;
}

const EXPENSE_TYPE_LIST = EXPENSE_TYPES.join(', ');

const EXTRACTION_PROMPT = `You are a bank statement parser. Extract transactions from the following bank/credit card statement text.

Return ONLY a valid JSON array of objects with these exact fields:
- "date": string in "YYYY-MM-DD" format
- "type": one of [${EXPENSE_TYPE_LIST}]
- "item": the merchant/payee name (the brand)
- "info": additional description or reference
- "amount": number (positive value, the amount spent — ignore credits/payments/refunds)

Rules:
- Skip any credits, refunds, payments, balance entries, or fee reversals
- Only include debit/spending transactions
- Guess the best "type" category from the merchant name
- If unsure about category, use "other"
- Dates may be in DD/MM/YYYY, DD MMM YYYY, or other formats — always convert to YYYY-MM-DD
- Return ONLY the JSON array, no markdown, no explanation

Statement text:
`;

function parseJsonFromResponse(response: string): ParsedExpenseRow[] {
  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];
    return parsed
      .filter(
        (row) =>
          row.date &&
          typeof row.amount === 'number' &&
          row.amount > 0
      )
      .map((row) => ({
        date: String(row.date),
        type: EXPENSE_TYPES.includes(String(row.type) as ExpenseType)
          ? (String(row.type) as ExpenseType)
          : 'other',
        item: String(row.item ?? ''),
        info: String(row.info ?? ''),
        amount: Math.round(Number(row.amount) * 100) / 100,
      }));
  } catch {
    return [];
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Lazy import to avoid pdf-parse loading test fixtures at module init
  const pdf = (await import('pdf-parse')).default;
  const data = await pdf(buffer);
  return data.text;
}

function extractTextFromCsv(text: string): string {
  // For CSV, return as-is since it's already structured text
  return text;
}

function parseCsvDirectly(text: string): ParsedExpenseRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (!result.data.length) return [];

  // Try to map common CSV column names
  return result.data
    .map((row) => {
      const date =
        row.date ??
        row['transaction date'] ??
        row['posting date'] ??
        row['value date'] ??
        '';
      const description =
        row.description ??
        row['transaction description'] ??
        row.merchant ??
        row.payee ??
        row.details ??
        '';
      const amountStr =
        row.amount ??
        row.debit ??
        row['withdrawal'] ??
        row['debit amount'] ??
        '0';
      const amount = Math.abs(parseFloat(amountStr.replace(/[,$]/g, '')) || 0);

      if (!date || amount <= 0) return null;

      return {
        date: normalizeDate(date),
        type: 'other' as ExpenseType,
        item: description.split(/[-/]/, 2)[0]?.trim() ?? description,
        info: description,
        amount,
      };
    })
    .filter((row): row is ParsedExpenseRow => row !== null);
}

function normalizeDate(dateStr: string): string {
  // Try common SG bank date formats
  const trimmed = dateStr.trim();

  // DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }

  // DD MMM YYYY or DD-MMM-YYYY
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const namedMatch = trimmed.match(/^(\d{1,2})[\s-](\w{3})[\s-](\d{4})$/i);
  if (namedMatch) {
    const month = monthNames[namedMatch[2].toLowerCase()];
    if (month) {
      return `${namedMatch[3]}-${month}-${namedMatch[1].padStart(2, '0')}`;
    }
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Fallback: try native parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return trimmed;
}

export async function parseStatement(
  fileBuffer: Buffer,
  fileName: string
): Promise<{ rows: ParsedExpenseRow[]; usedAi: boolean }> {
  const ext = fileName.toLowerCase().split('.').pop();
  let rawText: string;

  if (ext === 'pdf') {
    rawText = await extractTextFromPdf(fileBuffer);
  } else if (ext === 'csv') {
    rawText = fileBuffer.toString('utf-8');

    // Try direct CSV parse first (more reliable if columns are clear)
    const directRows = parseCsvDirectly(rawText);
    if (directRows.length > 0) {
      // Still try AI for better categorization if available
      const aiAvailable = await isOllamaAvailable();
      if (aiAvailable) {
        try {
          const response = await queryOllama(EXTRACTION_PROMPT + rawText.slice(0, 8000));
          const aiRows = parseJsonFromResponse(response);
          if (aiRows.length > 0) return { rows: aiRows, usedAi: true };
        } catch {
          // Fall through to direct parse
        }
      }
      return { rows: directRows, usedAi: false };
    }

    rawText = extractTextFromCsv(rawText);
  } else {
    throw new Error('Unsupported file type. Please upload a PDF or CSV.');
  }

  // Try AI extraction
  const aiAvailable = await isOllamaAvailable();
  if (aiAvailable) {
    try {
      // Limit text to avoid overwhelming the model
      const truncated = rawText.slice(0, 8000);
      const response = await queryOllama(EXTRACTION_PROMPT + truncated);
      const rows = parseJsonFromResponse(response);
      if (rows.length > 0) return { rows, usedAi: true };
    } catch {
      // Fall through to empty
    }
  }

  // No AI available or AI returned nothing
  return { rows: [], usedAi: false };
}

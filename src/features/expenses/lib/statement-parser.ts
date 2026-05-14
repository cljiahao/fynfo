import Papa from 'papaparse';
import type { ExpenseType } from '../types';

export interface ParsedExpenseRow {
  date: string; // yyyy-MM-dd
  type: ExpenseType;
  item: string;
  info: string;
  amount: number;
}

function parseCsvDirectly(text: string): ParsedExpenseRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (!result.data.length) return [];

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
  const trimmed = dateStr.trim();

  // DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }

  // DD MMM YYYY or DD-MMM-YYYY
  const monthNames: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
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

export function parseStatement(
  fileBuffer: Buffer,
  fileName: string
): { rows: ParsedExpenseRow[] } {
  const ext = fileName.toLowerCase().split('.').pop();

  if (ext !== 'csv') {
    throw new Error('Unsupported file type. Please upload a CSV.');
  }

  const text = fileBuffer.toString('utf-8');
  return { rows: parseCsvDirectly(text) };
}

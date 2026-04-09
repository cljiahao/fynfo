import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted above imports by vitest's transformer
vi.mock('@/features/expenses/lib/ollama', () => ({
  isOllamaAvailable: vi.fn().mockResolvedValue(false),
  queryOllama: vi.fn(),
}));

import { isOllamaAvailable, queryOllama } from '@/features/expenses/lib/ollama';
import { parseStatement } from '@/features/expenses/lib/statement-parser';

beforeEach(() => {
  vi.mocked(isOllamaAvailable).mockResolvedValue(false);
  vi.mocked(queryOllama).mockReset();
});

describe('parseStatement — unsupported file types', () => {
  it('throws for .txt files', async () => {
    await expect(parseStatement(Buffer.from('data'), 'file.txt')).rejects.toThrow(
      'Unsupported file type'
    );
  });

  it('throws for .xlsx files', async () => {
    await expect(parseStatement(Buffer.from('data'), 'report.xlsx')).rejects.toThrow(
      'Unsupported file type'
    );
  });
});

describe('parseStatement — CSV direct parsing', () => {
  it('parses rows with standard date/description/amount columns', async () => {
    const csv = `date,description,amount\n2026-01-15,Starbucks,5.50\n2026-01-16,NTUC Fairprice,23.40`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.usedAi).toBe(false);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].date).toBe('2026-01-15');
    expect(result.rows[0].amount).toBe(5.5);
    expect(result.rows[1].date).toBe('2026-01-16');
    expect(result.rows[1].amount).toBe(23.4);
  });

  it('recognises "transaction date" as the date column', async () => {
    const csv = `transaction date,description,amount\n2026-02-10,Grab,8.90`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].date).toBe('2026-02-10');
  });

  it('recognises "debit" as the amount column', async () => {
    const csv = `date,merchant,debit\n2026-03-01,Shell,60.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(60);
  });

  it('treats amount as absolute value (handles negative debit entries)', async () => {
    const csv = `date,description,debit\n2026-01-15,Grab,-12.50`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(12.5);
  });

  it('strips commas and dollar signs from amount', async () => {
    const csv = `date,description,amount\n2026-01-01,Rent,"$1,500.00"`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].amount).toBe(1500);
  });

  it('filters out rows with zero amounts', async () => {
    const csv = `date,description,amount\n2026-01-15,Shop,5.00\n2026-01-16,Credit,0`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(5);
  });

  it('filters out rows with missing date', async () => {
    const csv = `date,description,amount\n,Shop,5.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(0);
  });

  it('returns empty rows for a CSV with only headers', async () => {
    const csv = `date,description,amount\n`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(0);
    expect(result.usedAi).toBe(false);
  });

  it('defaults expense type to "other"', async () => {
    const csv = `date,description,amount\n2026-01-01,SomeShop,10.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].type).toBe('other');
  });

  it('populates info field from the full description', async () => {
    const csv = `date,description,amount\n2026-01-01,Grab Transport SG,12.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].info).toBe('Grab Transport SG');
  });
});

describe('parseStatement — CSV date normalisation', () => {
  it('normalises DD/MM/YYYY to YYYY-MM-DD', async () => {
    const csv = `date,description,amount\n25/12/2025,Christmas,80.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2025-12-25');
  });

  it('normalises single-digit day in DD/MM/YYYY', async () => {
    const csv = `date,description,amount\n1/3/2026,Coffee,5.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-03-01');
  });

  it('normalises DD MMM YYYY (space-separated named month)', async () => {
    const csv = `date,description,amount\n15 Jan 2026,Kopitiam,4.50`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-01-15');
  });

  it('normalises DD-MMM-YYYY (hyphen-separated named month)', async () => {
    const csv = `date,description,amount\n05-Mar-2026,Watsons,15.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-03-05');
  });

  it('passes through already-normalised YYYY-MM-DD dates', async () => {
    const csv = `date,description,amount\n2026-04-01,Koufu,6.50`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-04-01');
  });
});

describe('parseStatement — AI extraction path', () => {
  it('uses AI rows when AI is available and returns valid JSON', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockResolvedValue(
      '[{"date":"2026-01-15","type":"food_drink","item":"Starbucks","info":"Coffee","amount":5.5}]'
    );

    // CSV with no recognisable columns → direct parse returns empty → AI path is used
    const csv = `custom_col,transaction,value\nsomething,Starbucks,value3`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.usedAi).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].item).toBe('Starbucks');
    expect(result.rows[0].type).toBe('food_drink');
    expect(result.rows[0].amount).toBe(5.5);
  });

  it('extracts JSON array from markdown code-block response', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockResolvedValue(
      '```json\n[{"date":"2026-02-01","type":"transport","item":"Grab","info":"Ride","amount":12.0}]\n```'
    );

    const csv = `foo,bar\nval1,val2`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.usedAi).toBe(true);
    expect(result.rows[0].type).toBe('transport');
    expect(result.rows[0].amount).toBe(12);
  });

  it('defaults unknown AI expense type to "other"', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockResolvedValue(
      '[{"date":"2026-01-01","type":"unknown_category","item":"Store","info":"","amount":10.0}]'
    );

    const csv = `foo,bar\nval1,val2`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].type).toBe('other');
  });

  it('filters out AI rows with zero or negative amounts', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockResolvedValue(
      '[{"date":"2026-01-15","type":"other","item":"Refund","info":"","amount":-5.0},{"date":"2026-01-16","type":"other","item":"Zero","info":"","amount":0}]'
    );

    const csv = `foo,bar\nval1,val2`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    // AI returned empty (all filtered) → falls through to empty result
    expect(result.rows).toHaveLength(0);
    expect(result.usedAi).toBe(false);
  });

  it('falls back to empty when AI returns malformed JSON', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockResolvedValue('not valid json at all');

    const csv = `foo,bar\nval1,val2`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(0);
    expect(result.usedAi).toBe(false);
  });

  it('falls back to empty when AI throws', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockRejectedValue(new Error('connection refused'));

    const csv = `foo,bar\nval1,val2`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(0);
    expect(result.usedAi).toBe(false);
  });

  it('prefers AI rows over direct CSV parse when AI is available and returns data', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockResolvedValue(
      '[{"date":"2026-01-15","type":"groceries","item":"NTUC","info":"Grocery run","amount":45.0}]'
    );

    // Valid CSV that parseCsvDirectly can handle
    const csv = `date,description,amount\n2026-01-15,NTUC Fairprice,45.00`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    // AI takes precedence over direct parse when it returns valid rows
    expect(result.usedAi).toBe(true);
    expect(result.rows[0].type).toBe('groceries');
  });

  it('falls back to direct CSV rows when AI is available but returns empty', async () => {
    vi.mocked(isOllamaAvailable).mockResolvedValue(true);
    vi.mocked(queryOllama).mockResolvedValue('[]');

    const csv = `date,description,amount\n2026-01-15,Starbucks,5.50`;
    const result = await parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.usedAi).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(5.5);
  });
});

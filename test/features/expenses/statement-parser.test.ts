import { parseStatement } from '@/features/expenses/lib/statement-parser';
import { describe, expect, it } from 'vitest';

describe('parseStatement — unsupported file types', () => {
  it('throws for .txt files', () => {
    expect(() => parseStatement(Buffer.from('data'), 'file.txt')).toThrow(
      'Unsupported file type'
    );
  });

  it('throws for .xlsx files', () => {
    expect(() => parseStatement(Buffer.from('data'), 'report.xlsx')).toThrow(
      'Unsupported file type'
    );
  });
});

describe('parseStatement — CSV direct parsing', () => {
  it('parses rows with standard date/description/amount columns', () => {
    const csv = `date,description,amount\n2026-01-15,Starbucks,5.50\n2026-01-16,NTUC Fairprice,23.40`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].date).toBe('2026-01-15');
    expect(result.rows[0].amount).toBe(5.5);
    expect(result.rows[1].date).toBe('2026-01-16');
    expect(result.rows[1].amount).toBe(23.4);
  });

  it('recognises "transaction date" as the date column', () => {
    const csv = `transaction date,description,amount\n2026-02-10,Grab,8.90`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].date).toBe('2026-02-10');
  });

  it('recognises "debit" as the amount column', () => {
    const csv = `date,merchant,debit\n2026-03-01,Shell,60.00`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(60);
  });

  it('treats amount as absolute value (handles negative debit entries)', () => {
    const csv = `date,description,debit\n2026-01-15,Grab,-12.50`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(12.5);
  });

  it('strips commas and dollar signs from amount', () => {
    const csv = `date,description,amount\n2026-01-01,Rent,"$1,500.00"`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].amount).toBe(1500);
  });

  it('filters out rows with zero amounts', () => {
    const csv = `date,description,amount\n2026-01-15,Shop,5.00\n2026-01-16,Credit,0`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(5);
  });

  it('filters out rows with missing date', () => {
    const csv = `date,description,amount\n,Shop,5.00`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(0);
  });

  it('returns empty rows for a CSV with only headers', () => {
    const csv = `date,description,amount\n`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows).toHaveLength(0);
  });

  it('defaults expense type to "other"', () => {
    const csv = `date,description,amount\n2026-01-01,SomeShop,10.00`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].type).toBe('other');
  });

  it('populates info field from the full description', () => {
    const csv = `date,description,amount\n2026-01-01,Grab Transport SG,12.00`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].info).toBe('Grab Transport SG');
  });
});

describe('parseStatement — CSV date normalisation', () => {
  it('normalises DD/MM/YYYY to YYYY-MM-DD', () => {
    const csv = `date,description,amount\n25/12/2025,Christmas,80.00`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2025-12-25');
  });

  it('normalises single-digit day in DD/MM/YYYY', () => {
    const csv = `date,description,amount\n1/3/2026,Coffee,5.00`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-03-01');
  });

  it('normalises DD MMM YYYY (space-separated named month)', () => {
    const csv = `date,description,amount\n15 Jan 2026,Kopitiam,4.50`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-01-15');
  });

  it('normalises DD-MMM-YYYY (hyphen-separated named month)', () => {
    const csv = `date,description,amount\n05-Mar-2026,Watsons,15.00`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-03-05');
  });

  it('passes through already-normalised YYYY-MM-DD dates', () => {
    const csv = `date,description,amount\n2026-04-01,Koufu,6.50`;
    const result = parseStatement(Buffer.from(csv), 'statement.csv');

    expect(result.rows[0].date).toBe('2026-04-01');
  });
});

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const TYPE_MAP: Record<string, string> = {
  'Bills': 'bills',
  'Charity': 'charity',
  'Electronics': 'electronics',
  'Entertainment': 'entertainment',
  'Food & Drink': 'food_drink',
  'Gift': 'gift',
  'Groceries': 'groceries',
  'Health': 'health',
  'Insurance': 'insurance',
  'Other': 'other',
  'Shopping': 'shopping',
  'Subscriptions': 'subscriptions',
  'Transport': 'transport',
  'Travel': 'travel',
};

function parseDate(dateStr: string): Date {
  const parts = dateStr.trim().split(' ');
  const day = parseInt(parts[0]);
  const monthNames: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const month = monthNames[parts[1]];
  const year = parseInt(parts[2]);
  return new Date(year, month, day);
}

interface ParsedExpense {
  date: Date;
  type: string;
  item: string;
  info: string;
  amount: number;
  splitType: 'self' | 'shared';
  splits: { person: string; amount: number; settled: boolean }[];
}

function parseLine(line: string): ParsedExpense | null {
  const parts = line.split('\t');
  if (parts.length < 7) return null;

  const [dateStr, typeStr, item, info, amountStr, splitWho] = parts;

  const type = TYPE_MAP[typeStr.trim()];
  if (!type) return null;

  const amount = parseFloat(amountStr.trim());
  if (isNaN(amount) || amount <= 0) return null;

  const split = splitWho.trim();

  let splitType: 'self' | 'shared' = 'self';
  let splits: { person: string; amount: number; settled: boolean }[] = [];

  if (split === 'Shared') {
    splitType = 'shared';
    const perPerson = Math.round((amount / 2) * 100) / 100;
    splits = [{ person: 'Lydia', amount: perPerson, settled: false }];
  } else if (split === 'Lydia') {
    splitType = 'shared';
    splits = [{ person: 'Lydia', amount, settled: false }];
  }

  return {
    date: parseDate(dateStr),
    type,
    item: item.trim(),
    info: info.trim(),
    amount,
    splitType,
    splits,
  };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const user = await prisma.user.findFirst();
  if (!user) { console.log('No user found'); return; }
  console.log('User:', user.id, user.name);

  // Delete existing
  const deleted = await prisma.expenseRecord.deleteMany({ where: { userId: user.id } });
  console.log(`Deleted ${deleted.count} existing expenses`);

  // Read TSV file
  const dataPath = path.join(import.meta.dirname, 'expenses-data.tsv');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const lines = rawData.split('\n').filter((l) => l.trim() && !l.startsWith('Date Spent'));
  console.log(`Parsing ${lines.length} lines...`);

  let created = 0;
  let skipped = 0;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) { skipped++; continue; }

    await prisma.expenseRecord.create({
      data: {
        userId: user.id,
        date: parsed.date,
        type: parsed.type,
        item: parsed.item,
        info: parsed.info,
        amount: parsed.amount,
        splitType: parsed.splitType,
        splits: parsed.splits.length > 0
          ? { createMany: { data: parsed.splits } }
          : undefined,
      },
    });

    created++;
    if (created % 200 === 0) console.log(`  Created ${created}...`);
  }

  console.log(`Done! Created ${created}, skipped ${skipped}.`);
  await prisma.$disconnect();
}

main().catch(console.error);

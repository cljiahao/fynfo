import { FAQ_ITEMS, FEATURES } from '@/features/marketing/constants';
import { describe, expect, it } from 'vitest';

const faqText = FAQ_ITEMS.map((f) => `${f.question} ${f.answer}`)
  .join(' ')
  .toLowerCase();

describe('marketing FAQ copy', () => {
  it('drops the stale broker + JSON-import claims', () => {
    expect(faqText).not.toContain('tiger');
    expect(faqText).not.toContain('ibkr');
    expect(faqText).not.toContain('import'); // no import feature exists
  });

  it('states the actual supported brokers and the export capability', () => {
    expect(faqText).toContain('dbs vickers');
    expect(faqText).toContain('moomoo');
    expect(faqText).toContain('backup'); // data export is real
  });

  it('every FAQ entry has a question and an answer', () => {
    for (const item of FAQ_ITEMS) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.length).toBeGreaterThan(0);
    }
  });
});

describe('marketing features', () => {
  it('lists the four product pillars', () => {
    expect(FEATURES).toHaveLength(4);
    expect(FEATURES.every((f) => f.title && f.description && f.icon)).toBe(
      true
    );
  });
});

const SGD_FORMATTER = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  minimumFractionDigits: 2,
});

const SGD_WHOLE_FORMATTER = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const CURRENCY_FORMATTERS = {
  SGD: SGD_FORMATTER,
  USD: new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }),
};

export function formatSGD(value: number): string {
  return SGD_FORMATTER.format(value);
}

export function formatSGDWhole(value: number): string {
  return SGD_WHOLE_FORMATTER.format(value);
}

export function formatUSD(value: number): string {
  return USD_FORMATTER.format(value);
}

export function formatCurrency(
  value: number,
  currency: 'SGD' | 'USD' = 'SGD'
): string {
  return CURRENCY_FORMATTERS[currency].format(value);
}

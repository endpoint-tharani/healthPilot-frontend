import Decimal from 'decimal.js';

/**
 * All arithmetic the UI performs (receipt splits, allocation remainders, preview
 * totals) goes through decimal.js. Backend values arrive as fixed-point strings
 * and are never converted to a JS number, so `0.1 + 0.2` problems cannot occur.
 * The backend remains the authority for every stored figure.
 */
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = string | number | Decimal | null | undefined;

export function dec(value: DecimalInput): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

export function sumDecimals(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, value) => acc.plus(dec(value)), new Decimal(0));
}

/** Money rounding matches the backend: half-up to 2 decimal places. */
export function money(value: DecimalInput): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Renders 52500 as "₹52,500.00" from the exact string the backend sent. */
export function formatMoney(value: DecimalInput): string {
  return `₹${currencyFormatter.format(Number(money(value).toFixed(2)))}`;
}

/** Quantities keep two decimals but drop a trailing ".00" for readability. */
export function formatQuantity(value: DecimalInput): string {
  const quantity = dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return quantity.isInteger() ? quantity.toFixed(0) : quantity.toFixed(2);
}

export { Decimal };

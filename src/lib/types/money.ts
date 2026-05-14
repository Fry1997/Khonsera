// Money primitive. Stored as minor units (pence/cents) in code; DB columns
// remain NUMERIC(10,2) major-units for now (existing schema) but every read
// goes through fromDb() and every write goes through toDb() so we never
// arithmetic in JS floats on money values.

import { z } from "zod";

export type Currency = "GBP" | "EUR" | "USD";

export type Money = {
  amountMinor: number; // integer pence/cents
  currency: Currency;
};

export const moneySchema: z.ZodType<Money> = z.object({
  amountMinor: z.number().int(),
  currency: z.enum(["GBP", "EUR", "USD"]),
});

export const Money = {
  of(amountMinor: number, currency: Currency = "GBP"): Money {
    if (!Number.isInteger(amountMinor)) {
      throw new Error(`Money amountMinor must be an integer, got ${amountMinor}`);
    }
    return { amountMinor, currency };
  },

  fromMajor(amountMajor: number, currency: Currency = "GBP"): Money {
    return Money.of(Math.round(amountMajor * 100), currency);
  },

  // DB roundtrip. NUMERIC(10,2) arrives as a string from supabase-js.
  fromDb(value: string | number | null, currency: Currency = "GBP"): Money | null {
    if (value === null) return null;
    const major = typeof value === "string" ? Number.parseFloat(value) : value;
    if (!Number.isFinite(major)) return null;
    return Money.fromMajor(major, currency);
  },

  toDb(m: Money | null): { amount: number | null; currency: Currency | null } {
    if (!m) return { amount: null, currency: null };
    return { amount: m.amountMinor / 100, currency: m.currency };
  },

  add(a: Money, b: Money): Money {
    if (a.currency !== b.currency) {
      throw new Error(`Cannot add ${a.currency} + ${b.currency}`);
    }
    return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
  },

  format(m: Money, locale = "en-GB"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: m.currency,
    }).format(m.amountMinor / 100);
  },
};

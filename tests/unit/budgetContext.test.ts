import { describe, it, expect } from 'vitest';
import { buildBudgetContext, renderBudgetContext } from '../../api/lib/budgetContext.js';
import type { BudgetTier } from '../../api/lib/budgetContext.js';

// ---------------------------------------------------------------------------
// buildBudgetContext — undefined / missing arg guards
// ---------------------------------------------------------------------------

describe('buildBudgetContext — missing arguments', () => {
  it('returns undefined when countryIso2 is missing', () => {
    expect(buildBudgetContext(undefined, 'Italy', 'budget', '€')).toBeUndefined();
  });

  it('returns undefined when tier is missing', () => {
    expect(buildBudgetContext('IT', 'Italy', undefined, '€')).toBeUndefined();
  });

  it('returns undefined when currency is missing', () => {
    expect(buildBudgetContext('IT', 'Italy', 'budget', undefined)).toBeUndefined();
  });

  it('returns undefined for an unknown ISO-2 code', () => {
    expect(buildBudgetContext('XX', 'Unknown', 'budget', 'XYZ')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBudgetContext — country lookup + cost band assignment
// ---------------------------------------------------------------------------

describe('buildBudgetContext — cost band assignment', () => {
  it('assigns ultra_cheap for Kyrgyzstan (KGS index 18)', () => {
    const ctx = buildBudgetContext('KG', 'Kyrgyzstan', 'budget', 'KGS');
    expect(ctx?.costBand).toBe('ultra_cheap');
  });

  it('assigns cheap for Morocco (MA index 28)', () => {
    const ctx = buildBudgetContext('MA', 'Morocco', 'budget', 'MAD');
    expect(ctx?.costBand).toBe('cheap');
  });

  it('assigns moderate for Poland (PL index 43)', () => {
    const ctx = buildBudgetContext('PL', 'Poland', 'budget', 'PLN');
    expect(ctx?.costBand).toBe('moderate');
  });

  it('assigns average for Italy (IT index 64)', () => {
    const ctx = buildBudgetContext('IT', 'Italy', 'budget', '€');
    expect(ctx?.costBand).toBe('average');
  });

  it('assigns above_avg for Germany (DE index 72)', () => {
    const ctx = buildBudgetContext('DE', 'Germany', 'budget', '€');
    expect(ctx?.costBand).toBe('above_avg');
  });

  it('assigns expensive for UK (GB index 79)', () => {
    const ctx = buildBudgetContext('GB', 'UK', 'budget', '£');
    expect(ctx?.costBand).toBe('expensive');
  });

  it('assigns very_expensive for Switzerland (CH index 96)', () => {
    const ctx = buildBudgetContext('CH', 'Switzerland', 'budget', 'CHF');
    expect(ctx?.costBand).toBe('very_expensive');
  });
});

// ---------------------------------------------------------------------------
// buildBudgetContext — calibration note content
// ---------------------------------------------------------------------------

describe('buildBudgetContext — calibration note', () => {
  it('calibration note includes the country name', () => {
    const ctx = buildBudgetContext('IT', 'Italy', 'mid-range', '€');
    expect(ctx?.calibrationNote).toContain('Italy');
  });

  it('calibration note includes the currency for expensive countries (budget tier)', () => {
    const ctx = buildBudgetContext('GB', 'United Kingdom', 'budget', '£');
    expect(ctx?.calibrationNote).toContain('£');
  });

  it('calibration note is non-empty for every tier × cheap country', () => {
    for (const tier of ['budget', 'mid-range', 'luxury'] as BudgetTier[]) {
      const ctx = buildBudgetContext('VN', 'Vietnam', tier, 'VND');
      expect(ctx?.calibrationNote.length).toBeGreaterThan(20);
    }
  });

  it('calibration note is non-empty for every tier × expensive country', () => {
    for (const tier of ['budget', 'mid-range', 'luxury'] as BudgetTier[]) {
      const ctx = buildBudgetContext('CH', 'Switzerland', tier, 'CHF');
      expect(ctx?.calibrationNote.length).toBeGreaterThan(20);
    }
  });

  it('preserves the tier on the returned object', () => {
    const ctx = buildBudgetContext('JP', 'Japan', 'luxury', 'JPY');
    expect(ctx?.tier).toBe('luxury');
  });

  it('uses fallback countryName from iso2 when name is omitted', () => {
    const ctx = buildBudgetContext('IT', undefined, 'budget', '€');
    // Should fall back to the iso2 code as name
    expect(ctx?.countryName).toBe('IT');
  });
});

// ---------------------------------------------------------------------------
// renderBudgetContext — emoji tier labels
// ---------------------------------------------------------------------------

describe('renderBudgetContext', () => {
  it('uses 🟨 BUDGET label for budget tier', () => {
    const ctx = buildBudgetContext('ES', 'Spain', 'budget', '€')!;
    expect(renderBudgetContext(ctx)).toContain('🟨 BUDGET');
  });

  it('uses 🟩 MID-RANGE label for mid-range tier', () => {
    const ctx = buildBudgetContext('ES', 'Spain', 'mid-range', '€')!;
    expect(renderBudgetContext(ctx)).toContain('🟩 MID-RANGE');
  });

  it('uses 🟦 LUXURY label for luxury tier', () => {
    const ctx = buildBudgetContext('ES', 'Spain', 'luxury', '€')!;
    expect(renderBudgetContext(ctx)).toContain('🟦 LUXURY');
  });

  it('includes the country name in the rendered output', () => {
    const ctx = buildBudgetContext('JP', 'Japan', 'mid-range', 'JPY')!;
    expect(renderBudgetContext(ctx)).toContain('Japan');
  });
});

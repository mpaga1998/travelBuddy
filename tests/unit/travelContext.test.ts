import { describe, it, expect } from 'vitest';
import { buildTravelContext } from '../../api/lib/travelContext.js';

// ---------------------------------------------------------------------------
// Country / currency inference
// ---------------------------------------------------------------------------

describe('buildTravelContext — country & currency inference', () => {
  it('infers Italy and EUR from "Rome, Italy"', () => {
    const ctx = buildTravelContext('Rome, Italy', '2026-09-10', '2026-09-13');
    expect(ctx.countryIso2).toBe('IT');
    expect(ctx.currency).toBe('EUR');
    expect(ctx.units).toBe('metric');
  });

  it('infers Thailand and THB from "Bangkok, Thailand"', () => {
    const ctx = buildTravelContext('Bangkok, Thailand', '2026-12-01', '2026-12-06');
    expect(ctx.countryIso2).toBe('TH');
    expect(ctx.currency).toBe('THB');
  });

  it('infers UK and GBP from "London, United Kingdom"', () => {
    const ctx = buildTravelContext('London, United Kingdom', '2026-11-05', '2026-11-08');
    expect(ctx.countryIso2).toBe('GB');
    expect(ctx.currency).toBe('GBP');
  });

  it('infers Japan and JPY from "Tokyo, Japan"', () => {
    const ctx = buildTravelContext('Tokyo, Japan', '2026-04-01', '2026-04-08');
    expect(ctx.countryIso2).toBe('JP');
    expect(ctx.currency).toBe('JPY');
  });

  it('infers Kyrgyzstan and KGS from "Bishkek, Kyrgyzstan"', () => {
    const ctx = buildTravelContext('Bishkek, Kyrgyzstan', '2026-07-10', '2026-07-17');
    expect(ctx.countryIso2).toBe('KG');
    expect(ctx.currency).toBe('KGS');
  });

  it('falls back to USD and metric for an unknown location', () => {
    const ctx = buildTravelContext('Atlantis, Fictional Land', '2026-06-01', '2026-06-05');
    expect(ctx.currency).toBe('USD');
    expect(ctx.units).toBe('metric');
    expect(ctx.countryIso2).toBeUndefined();
  });

  it('handles multi-word country: "South Korea"', () => {
    const ctx = buildTravelContext('Seoul, South Korea', '2026-03-15', '2026-03-19');
    expect(ctx.countryIso2).toBe('KR');
    expect(ctx.currency).toBe('KRW');
  });
});

// ---------------------------------------------------------------------------
// Transport hints
// ---------------------------------------------------------------------------

describe('buildTravelContext — transport hints', () => {
  it('returns a transport hint for a known country', () => {
    const ctx = buildTravelContext('Berlin, Germany', '2026-08-20', '2026-08-24');
    const hint = ctx.transportHints.find((h) => h.apps.some((a) => a.includes('DB')));
    expect(hint).toBeDefined();
    expect(hint?.intracity).toContain('U-Bahn');
  });

  it('includes hints for both countries in a multi-stop trip', () => {
    const ctx = buildTravelContext(
      'Berlin, Germany',
      '2026-04-10',
      '2026-04-15',
      ['Berlin, Germany', 'Krakow, Poland'],
    );
    const countries = ctx.transportHints.map((h) => h.apps).flat().join(' ');
    // DE hint has DB Navigator; PL hint has PKP
    expect(countries).toContain('DB Navigator');
    expect(countries).toContain('PKP');
  });

  it('deduplicates hints when arrival and departure are in the same country', () => {
    const ctx = buildTravelContext(
      'Lisbon, Portugal',
      '2026-07-01',
      '2026-07-15',
      ['Lisbon, Portugal', 'Porto, Portugal'],
    );
    // Both cities are PT — should appear only once
    const ptHints = ctx.transportHints.filter((h) => h.apps.includes('CP – Comboios de Portugal'));
    expect(ptHints).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

describe('buildTravelContext — holiday detection', () => {
  it('detects Italian Republic Day (June 2) for a June trip to Italy', () => {
    const ctx = buildTravelContext('Rome, Italy', '2026-06-01', '2026-06-05');
    const names = ctx.holidays.map((h) => h.name);
    expect(names.some((n) => n.toLowerCase().includes('republic') || n.toLowerCase().includes('repubblica'))).toBe(true);
  });

  it('returns an empty holidays array for unknown country', () => {
    const ctx = buildTravelContext('Nowheresville, Made-Up', '2026-06-01', '2026-06-05');
    expect(ctx.holidays).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Religious / cultural periods
// ---------------------------------------------------------------------------

describe('buildTravelContext — religious periods', () => {
  it('detects Ramadan 2026 overlap for a Morocco trip in February', () => {
    // Ramadan 2026: 2026-02-17 to 2026-03-18
    const ctx = buildTravelContext('Marrakech, Morocco', '2026-02-15', '2026-02-22');
    expect(ctx.religiousPeriods.some((p) => p.name.includes('Ramadan'))).toBe(true);
  });

  it('does NOT flag Ramadan for Italy (not in impact set)', () => {
    const ctx = buildTravelContext('Rome, Italy', '2026-02-15', '2026-02-22');
    expect(ctx.religiousPeriods.some((p) => p.name.includes('Ramadan'))).toBe(false);
  });
});

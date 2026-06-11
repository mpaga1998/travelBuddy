import { describe, it, expect } from 'vitest';
import { validateTripInput, calculateNights } from '../../api/lib/inputValidation.js';
import type { TripInput } from '../../api/lib/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base(): TripInput {
  return {
    arrival:   { date: '2026-09-10', location: 'Rome, Italy',  time: 'afternoon' },
    departure: { date: '2026-09-13', location: 'Rome, Italy',  time: 'morning'   },
    budget: 'mid-range',
    travelPace: 'moderate',
  };
}

function fieldErrors(input: TripInput) {
  return validateTripInput(input).map((e) => e.field);
}

// ---------------------------------------------------------------------------
// calculateNights
// ---------------------------------------------------------------------------

describe('calculateNights', () => {
  it('returns 3 for a 3-night trip', () => {
    expect(calculateNights(base())).toBe(3);
  });

  it('returns 1 for a single-night stay', () => {
    const t = base();
    t.departure.date = '2026-09-11';
    expect(calculateNights(t)).toBe(1);
  });

  it('returns 14 for a two-week trip', () => {
    const t = base();
    t.departure.date = '2026-09-24';
    expect(calculateNights(t)).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// validateTripInput — happy path
// ---------------------------------------------------------------------------

describe('validateTripInput — valid input', () => {
  it('returns no errors for a complete, valid trip', () => {
    expect(validateTripInput(base())).toHaveLength(0);
  });

  it('accepts optional fields being absent', () => {
    const t: TripInput = {
      arrival:   { date: '2026-09-10', location: 'Rome, Italy' },
      departure: { date: '2026-09-13', location: 'Rome, Italy' },
    };
    expect(validateTripInput(t)).toHaveLength(0);
  });

  it('accepts all valid travelPace values', () => {
    for (const pace of ['relaxed', 'moderate', 'active'] as const) {
      const t = { ...base(), travelPace: pace };
      expect(fieldErrors(t)).not.toContain('travelPace');
    }
  });

  it('accepts all valid budget values', () => {
    for (const budget of ['budget', 'mid-range', 'luxury'] as const) {
      const t = { ...base(), budget };
      expect(fieldErrors(t)).not.toContain('budget');
    }
  });

  it('accepts desiredAttractions as an array', () => {
    const t = { ...base(), desiredAttractions: ['Colosseum', 'Trastevere'] };
    expect(fieldErrors(t)).not.toContain('desiredAttractions');
  });
});

// ---------------------------------------------------------------------------
// validateTripInput — required-field errors
// ---------------------------------------------------------------------------

describe('validateTripInput — missing required fields', () => {
  it('errors when arrival is missing', () => {
    const t = base();
    // @ts-expect-error intentional — testing runtime guard
    delete t.arrival;
    expect(fieldErrors(t)).toContain('arrival');
  });

  it('errors when departure is missing', () => {
    const t = base();
    // @ts-expect-error intentional
    delete t.departure;
    expect(fieldErrors(t)).toContain('departure');
  });

  it('errors when arrival location is empty', () => {
    const t = base();
    t.arrival.location = '   ';
    expect(fieldErrors(t)).toContain('arrival.location');
  });

  it('errors when departure location is empty', () => {
    const t = base();
    t.departure.location = '';
    expect(fieldErrors(t)).toContain('departure.location');
  });
});

// ---------------------------------------------------------------------------
// validateTripInput — date errors
// ---------------------------------------------------------------------------

describe('validateTripInput — date validation', () => {
  it('errors when arrival date is invalid', () => {
    const t = base();
    t.arrival.date = 'not-a-date';
    expect(fieldErrors(t)).toContain('arrival.date');
  });

  it('errors when departure date is invalid', () => {
    const t = base();
    t.departure.date = '99-99-9999';
    expect(fieldErrors(t)).toContain('departure.date');
  });

  it('errors when departure is before arrival', () => {
    const t = base();
    t.departure.date = '2026-09-09'; // one day before arrival
    expect(fieldErrors(t)).toContain('dates');
  });

  it('errors when departure equals arrival (0 nights)', () => {
    const t = base();
    t.departure.date = t.arrival.date;
    expect(fieldErrors(t)).toContain('dates');
  });

  it('allows exactly 365 nights', () => {
    const t = base();
    t.departure.date = '2027-09-10';
    expect(fieldErrors(t)).not.toContain('dates');
  });

  it('errors when trip exceeds 365 nights', () => {
    const t = base();
    t.departure.date = '2027-09-11'; // 366 days later
    expect(fieldErrors(t)).toContain('dates');
  });
});

// ---------------------------------------------------------------------------
// validateTripInput — optional field validation
// ---------------------------------------------------------------------------

describe('validateTripInput — optional field validation', () => {
  it('errors on invalid travelPace', () => {
    const t = { ...base(), travelPace: 'sprint' as 'active' };
    expect(fieldErrors(t)).toContain('travelPace');
  });

  it('errors on invalid budget', () => {
    const t = { ...base(), budget: 'extreme' as 'luxury' };
    expect(fieldErrors(t)).toContain('budget');
  });

  it('errors when desiredAttractions is not an array', () => {
    // @ts-expect-error intentional
    const t = { ...base(), desiredAttractions: 'Colosseum' };
    expect(fieldErrors(t)).toContain('desiredAttractions');
  });
});

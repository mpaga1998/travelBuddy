import { describe, it, expect, vi, afterEach } from 'vitest';

// The OpenAI client is instantiated at module-level in extractPlaces.ts.
// Mock it before any import so it does not throw for a missing API key.
vi.mock('openai', () => ({
  // Must be a real class so `new OpenAI(...)` doesn't throw "not a constructor"
  default: class {
    chat = { completions: { create: vi.fn() } };
  },
}));

import { parseRawPlacesJson } from '../../api/lib/extractPlaces.js';

// ---------------------------------------------------------------------------
// parseRawPlacesJson — pure JSON parsing
// ---------------------------------------------------------------------------

describe('parseRawPlacesJson', () => {
  it('parses a valid JSON array of places', () => {
    const raw = JSON.stringify([
      { name: 'Colosseum',  day: 1, type: 'sight', context: 'Visit the Colosseum in the morning.' },
      { name: 'Trastevere', day: 1, type: 'food',  context: 'Dinner in Trastevere.' },
    ]);
    const result = parseRawPlacesJson(raw);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Colosseum');
    expect(result[1].type).toBe('food');
  });

  it('strips leading ```json fence before parsing', () => {
    const raw = '```json\n[{"name":"Bar San Calisto","day":2,"type":"nightlife","context":"Locals favourite."}]\n```';
    const result = parseRawPlacesJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bar San Calisto');
  });

  it('strips leading ``` fence (no language tag) before parsing', () => {
    const raw = '```\n[{"name":"Pantheon","day":1,"type":"sight","context":"Free entry."}]\n```';
    const result = parseRawPlacesJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Pantheon');
  });

  it('returns empty array for non-array JSON', () => {
    expect(parseRawPlacesJson('{"name":"Colosseum"}')).toEqual([]);
  });

  it('returns empty array for completely invalid JSON', () => {
    expect(parseRawPlacesJson('this is not json')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseRawPlacesJson('')).toEqual([]);
  });

  it('filters out items missing the name field', () => {
    const raw = JSON.stringify([
      { day: 1, type: 'sight', context: 'No name here.' },
      { name: 'Vatican Museums', day: 2, type: 'sight', context: 'Book in advance.' },
    ]);
    const result = parseRawPlacesJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Vatican Museums');
  });

  it('filters out items missing the context field', () => {
    const raw = JSON.stringify([
      { name: 'Trevi Fountain', day: 1, type: 'sight' },
      { name: 'Campo de Fiori', day: 1, type: 'food', context: 'Morning market.' },
    ]);
    expect(parseRawPlacesJson(raw)).toHaveLength(1);
  });

  it('coerces day from string to number', () => {
    const raw = JSON.stringify([
      { name: 'Borghese Gallery', day: '2', type: 'sight', context: 'Book ahead.' },
    ]);
    const result = parseRawPlacesJson(raw);
    expect(result[0].day).toBe(2);
    expect(typeof result[0].day).toBe('number');
  });

  it('falls back day to 1 when day is unparseable', () => {
    const raw = JSON.stringify([
      { name: 'Piazza Navona', day: 'abc', type: 'sight', context: 'Baroque fountains.' },
    ]);
    const result = parseRawPlacesJson(raw);
    expect(result[0].day).toBe(1);
  });

  it('preserves valid type strings without coercion', () => {
    const types = ['food', 'sight', 'nightlife', 'shop', 'transport', 'accommodation'];
    for (const type of types) {
      const raw = JSON.stringify([{ name: 'Place', day: 1, type, context: 'ctx.' }]);
      expect(parseRawPlacesJson(raw)[0].type).toBe(type);
    }
  });
});

// ---------------------------------------------------------------------------
// geocodePlace — no-token fast path
//
// MAPBOX_TOKEN is a module-level constant captured at import time.
// vi.resetModules() must run BEFORE vi.stubEnv so that the dynamic import
// picks up a fresh module with the stubbed value.
// vi.mock('openai') is registered globally and survives module resets.
// ---------------------------------------------------------------------------

describe('geocodePlace — no MAPBOX_TOKEN', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns null immediately when MAPBOX_TOKEN is empty', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubEnv('MAPBOX_TOKEN', '');

    const { geocodePlace } = await import('../../api/lib/extractPlaces.js');
    expect(await geocodePlace('Colosseum', 41.89, 12.49)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// geocodePlace — fetch failure paths
// ---------------------------------------------------------------------------

describe('geocodePlace — fetch failures', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns null when fetch throws (network error)', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'fake-token');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { geocodePlace } = await import('../../api/lib/extractPlaces.js');
    expect(await geocodePlace('Colosseum', 41.89, 12.49)).toBeNull();
  });

  it('returns null when Mapbox returns a non-OK response', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'fake-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const { geocodePlace } = await import('../../api/lib/extractPlaces.js');
    expect(await geocodePlace('Colosseum', 41.89, 12.49)).toBeNull();
  });

  it('returns null when Mapbox returns no features', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'fake-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    }));

    const { geocodePlace } = await import('../../api/lib/extractPlaces.js');
    expect(await geocodePlace('Completely Unknown Place XYZ', 0, 0)).toBeNull();
  });

  it('returns coordinates when Mapbox returns a valid feature', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'fake-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ geometry: { coordinates: [12.4924, 41.8902] } }],
      }),
    }));

    const { geocodePlace } = await import('../../api/lib/extractPlaces.js');
    const result = await geocodePlace('Colosseum', 41.89, 12.49);
    expect(result).toEqual({ lat: 41.8902, lng: 12.4924 });
  });
});

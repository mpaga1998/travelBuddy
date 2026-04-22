import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { requireAuth } from '../lib/requireAuth.js';
import { validateBodySize } from '../lib/validateBodySize.js';
import { extractPlacesOnly, extractAndPersistPlaces } from '../lib/extractPlaces.js';

dotenv.config();

const MAPBOX_TOKEN = process.env.VITE_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN ?? '';
const GEOCODE_TIMEOUT_MS = 3000;

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=1&types=place,region,country`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const coords = json.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    return { lat: coords[1], lng: coords[0] };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'Method not allowed' }); return; }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!validateBodySize(req, res)) return;

  try {
    const { markdown, arrivalLocation, itineraryId } = req.body as {
      markdown?: string;
      arrivalLocation?: string;
      itineraryId?: string;
    };

    if (!markdown || typeof markdown !== 'string' || !markdown.trim()) {
      res.status(400).json({ success: false, error: 'markdown is required' });
      return;
    }
    if (!arrivalLocation || typeof arrivalLocation !== 'string') {
      res.status(400).json({ success: false, error: 'arrivalLocation is required' });
      return;
    }

    // Geocode the arrival location to get a proximity bias for Mapbox geocoding.
    const coords = await geocodeLocation(arrivalLocation);
    // Fall back to a central world bias when geocoding fails.
    const biasLat = coords?.lat ?? 20;
    const biasLng = coords?.lng ?? 0;

    let places;
    if (itineraryId && typeof itineraryId === 'string') {
      places = await extractAndPersistPlaces(itineraryId, markdown, biasLat, biasLng);
    } else {
      places = await extractPlacesOnly(markdown, biasLat, biasLng);
    }

    res.status(200).json({ success: true, places });
  } catch (err) {
    console.error('[EXTRACT endpoint] error:', err);
    res.status(500).json({ success: false, error: 'Failed to extract places' });
  }
}

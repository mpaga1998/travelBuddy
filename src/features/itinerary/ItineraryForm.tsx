import { useState, useEffect, useRef } from 'react';
import type { ItineraryInput } from './types';

interface LocationSuggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

const TRAVEL_PACE_OPTIONS = [
  { value: 'relaxed', label: 'Relaxed (few activities per day)' },
  { value: 'moderate', label: 'Moderate (balanced pace)' },
  { value: 'active', label: 'Active (packed itinerary)' },
] as const;

const BUDGET_OPTIONS = [
  { value: 'budget', label: '💰 Budget-friendly' },
  { value: 'mid-range', label: '💰💰 Mid-range' },
  { value: 'luxury', label: '💰💰💰 Luxury' },
] as const;

const INTEREST_OPTIONS = [
  'Architecture',
  'Art & Culture',
  'Food & Dining',
  'Nature & Hiking',
  'Beach & Water',
  'Nightlife',
  'Shopping',
  'History',
  'Photography',
  'Adventure',
] as const;

// Shared input styles — same visual treatment across every text field in the form.
const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border-2 border-black/25 text-sm box-border min-h-[44px] bg-white text-[#111]';
// Subtle-bordered input variant used by attractions textarea + notes textarea + custom-interest input.
const subtleInputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-black/[0.18] text-sm font-[inherit] box-border';
// Section heading label (emoji + category title).
const sectionLabelClass = 'text-[13px] font-bold block mb-3 text-[#111]';
// Inline "sub-label" above a field (e.g. Arrival Date).
const subLabelClass = 'text-[11px] font-semibold block mb-1.5 text-[#111]';
// Time-of-day pill button (morning/afternoon/night).
function timePillClass(active: boolean) {
  return `flex-1 px-1 py-2 rounded-md border-2 border-black/20 text-xs font-semibold cursor-pointer transition-colors ${
    active ? 'bg-[#0066cc] text-white' : 'bg-gray-100 text-[#111]'
  }`;
}
// Selectable-option pill (travel pace, budget).
function optionPillClass(active: boolean) {
  return `px-3 py-2.5 rounded-[10px] cursor-pointer text-[13px] min-h-[44px] ${
    active
      ? 'border-2 border-blue-600 bg-blue-50 font-semibold text-blue-600'
      : 'border border-black/[0.18] bg-white font-medium text-[#111]'
  }`;
}
// Interest-chip pill (rounded-full). Shared between preset + custom chips.
function chipClass(active: boolean, extra = '') {
  return `px-3 py-2 rounded-full cursor-pointer text-xs whitespace-nowrap ${
    active
      ? 'border-2 border-blue-600 bg-blue-100 font-semibold text-blue-600'
      : 'border border-black/[0.18] bg-white font-medium text-[#111]'
  } ${extra}`;
}

export interface ItineraryFormProps {
  onSubmit: (input: ItineraryInput) => void;
  error: string | null;
  isMobile: boolean;
}

export function ItineraryForm({ onSubmit, error, isMobile }: ItineraryFormProps) {
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState<'morning' | 'afternoon' | 'night' | ''>('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState<'morning' | 'afternoon' | 'night' | ''>('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [attractions, setAttractions] = useState('');
  const [travelPace, setTravelPace] = useState<'relaxed' | 'moderate' | 'active'>('moderate');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [budget, setBudget] = useState<'budget' | 'mid-range' | 'luxury'>('mid-range');
  const [notes, setNotes] = useState('');

  // Location autocomplete
  const [arrivalSuggestions, setArrivalSuggestions] = useState<LocationSuggestion[]>([]);
  const [departureSuggestions, setDepartureSuggestions] = useState<LocationSuggestion[]>([]);
  const [showArrivalSuggestions, setShowArrivalSuggestions] = useState(false);
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const [isArrivalFocused, setIsArrivalFocused] = useState(false);
  const [isDepartureFocused, setIsDepartureFocused] = useState(false);
  const arrivalRef = useRef<HTMLDivElement>(null);
  const departureRef = useRef<HTMLDivElement>(null);

  // Stops
  const [stops, setStops] = useState<string[]>([]);
  const [currentStop, setCurrentStop] = useState('');
  const [stopSuggestions, setStopSuggestions] = useState<LocationSuggestion[]>([]);
  const [showStopSuggestions, setShowStopSuggestions] = useState(false);
  const [isStopFocused, setIsStopFocused] = useState(false);
  const stopRef = useRef<HTMLDivElement>(null);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

  // ── Autocomplete effects ──────────────────────────────────────────────────

  useEffect(() => {
    if (!arrivalLocation.trim()) {
      setArrivalSuggestions([]);
      setShowArrivalSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(arrivalLocation)}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await res.json();
        if (data.features?.length) {
          setArrivalSuggestions(data.features.map((f: { id: string; place_name: string; geometry: { coordinates: [number, number] } }) => ({ id: f.id, place_name: f.place_name, center: f.geometry.coordinates })));
          setShowArrivalSuggestions(true);
        } else {
          setArrivalSuggestions([]);
        }
      } catch (e) {
        console.error('Arrival suggestions fetch failed:', e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [arrivalLocation, mapboxToken]);

  useEffect(() => {
    if (!departureLocation.trim()) {
      setDepartureSuggestions([]);
      setShowDepartureSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(departureLocation)}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await res.json();
        if (data.features?.length) {
          setDepartureSuggestions(data.features.map((f: { id: string; place_name: string; geometry: { coordinates: [number, number] } }) => ({ id: f.id, place_name: f.place_name, center: f.geometry.coordinates })));
          setShowDepartureSuggestions(true);
        } else {
          setDepartureSuggestions([]);
        }
      } catch (e) {
        console.error('Departure suggestions fetch failed:', e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [departureLocation, mapboxToken]);

  useEffect(() => {
    if (!currentStop.trim()) {
      setStopSuggestions([]);
      setShowStopSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(currentStop)}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await res.json();
        if (data.features?.length) {
          setStopSuggestions(data.features.map((f: { id: string; place_name: string; geometry: { coordinates: [number, number] } }) => ({ id: f.id, place_name: f.place_name, center: f.geometry.coordinates })));
          setShowStopSuggestions(true);
        } else {
          setStopSuggestions([]);
        }
      } catch (e) {
        console.error('Stop suggestions fetch failed:', e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentStop, mapboxToken]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (arrivalRef.current && !arrivalRef.current.contains(event.target as Node)) {
        setShowArrivalSuggestions(false);
        setIsArrivalFocused(false);
      }
      if (departureRef.current && !departureRef.current.contains(event.target as Node)) {
        setShowDepartureSuggestions(false);
        setIsDepartureFocused(false);
      }
      if (stopRef.current && !stopRef.current.contains(event.target as Node)) {
        setShowStopSuggestions(false);
        setIsStopFocused(false);
      }
    };
    if (showArrivalSuggestions || showDepartureSuggestions || showStopSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showArrivalSuggestions, showDepartureSuggestions, showStopSuggestions]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleRemoveInterest = (interest: string) => {
    setSelectedInterests((prev) => prev.filter((i) => i !== interest));
  };

  const handleAddCustomInterest = () => {
    const trimmed = customInterestInput.trim();
    if (trimmed && !selectedInterests.includes(trimmed)) {
      setSelectedInterests((prev) => [...prev, trimmed]);
      setCustomInterestInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const attractionsList = attractions
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const input: ItineraryInput = {
      arrival: {
        date: arrivalDate,
        location: arrivalLocation,
        time: arrivalTime || undefined,
      },
      departure: {
        date: departureDate,
        location: departureLocation,
        time: departureTime || undefined,
      },
      stops: stops.length > 0 ? stops : undefined,
      desiredAttractions: attractionsList.length > 0 ? attractionsList : undefined,
      travelPace,
      interests: selectedInterests.length > 0 ? selectedInterests : undefined,
      budget,
      notes: notes.trim() || undefined,
    };

    onSubmit(input);
  };

  // ── Shared suggestion dropdown renderer ──────────────────────────────────

  const SuggestionDropdown = ({
    suggestions,
    onSelect,
  }: {
    suggestions: LocationSuggestion[];
    onSelect: (place_name: string) => void;
  }) => (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/15 rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-10 max-h-[200px] overflow-auto">
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onClick={() => onSelect(s.place_name)}
          className="block w-full p-3 border-none bg-transparent hover:bg-gray-100 text-left cursor-pointer text-[13px] text-[#111] border-b border-black/[0.08] last:border-b-0 outline-none"
        >
          🌍 {s.place_name}
        </button>
      ))}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const twoColGrid = `grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`;
  const threeColGrid = `grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="px-3.5 py-3 rounded-[10px] bg-red-100 text-red-900 text-sm border border-red-200">
          ❌ {error}
        </div>
      )}

      {/* When are you traveling? */}
      <div>
        <label className={sectionLabelClass}>📅 When are you traveling?</label>
        <div className={twoColGrid}>
          {/* Arrival date + time */}
          <div>
            <label className={subLabelClass}>Arrival Date</label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              required
              className={`${inputClass} mb-2 [color-scheme:light]`}
            />
            <div className="flex gap-1.5">
              {(['morning', 'afternoon', 'night'] as const).map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setArrivalTime(time)}
                  className={timePillClass(arrivalTime === time)}
                >
                  {time.charAt(0).toUpperCase() + time.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Departure date + time */}
          <div>
            <label className={subLabelClass}>Departure Date</label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              required
              className={`${inputClass} mb-2 [color-scheme:light]`}
            />
            <div className="flex gap-1.5">
              {(['morning', 'afternoon', 'night'] as const).map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setDepartureTime(time)}
                  className={timePillClass(departureTime === time)}
                >
                  {time.charAt(0).toUpperCase() + time.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Where are you going? */}
      <div>
        <label className={sectionLabelClass}>📍 Where are you going?</label>
        <div className={twoColGrid}>
          {/* Arrival location */}
          <div className="relative" ref={arrivalRef}>
            <label className={subLabelClass}>Arrival Location</label>
            <input
              type="text"
              value={arrivalLocation}
              onChange={(e) => setArrivalLocation(e.target.value)}
              onFocus={() => { setIsArrivalFocused(true); arrivalLocation.trim() && setShowArrivalSuggestions(true); }}
              onBlur={() => setIsArrivalFocused(false)}
              placeholder="e.g., Barcelona, Spain"
              required
              className={inputClass}
            />
            {showArrivalSuggestions && arrivalSuggestions.length > 0 && isArrivalFocused && (
              <SuggestionDropdown
                suggestions={arrivalSuggestions}
                onSelect={(name) => { setArrivalLocation(name); setShowArrivalSuggestions(false); setIsArrivalFocused(false); }}
              />
            )}
          </div>
          {/* Departure location */}
          <div className="relative" ref={departureRef}>
            <label className={subLabelClass}>Departure Location</label>
            <input
              type="text"
              value={departureLocation}
              onChange={(e) => setDepartureLocation(e.target.value)}
              onFocus={() => { setIsDepartureFocused(true); departureLocation.trim() && setShowDepartureSuggestions(true); }}
              onBlur={() => setIsDepartureFocused(false)}
              placeholder="e.g., Barcelona, Spain"
              required
              className={inputClass}
            />
            {showDepartureSuggestions && departureSuggestions.length > 0 && isDepartureFocused && (
              <SuggestionDropdown
                suggestions={departureSuggestions}
                onSelect={(name) => { setDepartureLocation(name); setShowDepartureSuggestions(false); setIsDepartureFocused(false); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Stops */}
      <div>
        <label className={sectionLabelClass}>🛑 Stops Along the Way (optional)</label>
        <div className="flex flex-col gap-2">
          <div className="relative" ref={stopRef}>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentStop}
                onChange={(e) => setCurrentStop(e.target.value)}
                onFocus={() => { setIsStopFocused(true); currentStop.trim() && setShowStopSuggestions(true); }}
                onBlur={() => setIsStopFocused(false)}
                placeholder="e.g., Valencia, Spain"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (currentStop.trim()) {
                    setStops((prev) => [...prev, currentStop.trim()]);
                    setCurrentStop('');
                    setShowStopSuggestions(false);
                  }
                }}
                className="px-3 py-2.5 rounded-[10px] border-none bg-blue-600 text-white cursor-pointer text-[13px] font-semibold min-h-[44px] min-w-[44px] shrink-0"
              >
                +
              </button>
            </div>
            {showStopSuggestions && stopSuggestions.length > 0 && isStopFocused && (
              <SuggestionDropdown
                suggestions={stopSuggestions}
                onSelect={(name) => { setCurrentStop(name); setShowStopSuggestions(false); setIsStopFocused(false); }}
              />
            )}
          </div>
          {stops.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {stops.map((stop, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2.5 bg-gray-100 rounded-lg border border-black/10"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#666]">#{index + 1}</span>
                    <span className="text-[13px] text-[#111]">🌍 {stop}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStops((prev) => prev.filter((_, i) => i !== index))}
                    className="px-2 py-1 rounded-md border-none bg-transparent hover:bg-red-100 text-red-600 cursor-pointer text-xs font-semibold outline-none transition-colors"
                  >
                    ✕ Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attractions */}
      <div>
        <label className={sectionLabelClass}>🎯 Places to visit (optional)</label>
        <textarea
          value={attractions}
          onChange={(e) => setAttractions(e.target.value)}
          placeholder="e.g., Sagrada Familia, Park Güell, Gothic Quarter (separate by comma)"
          rows={3}
          className={`${subtleInputClass} resize-y min-h-[80px] bg-white text-[#111]`}
        />
      </div>

      {/* Travel Pace */}
      <div>
        <label className={sectionLabelClass}>⚡ Travel Pace</label>
        <div className={threeColGrid}>
          {TRAVEL_PACE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTravelPace(option.value)}
              className={optionPillClass(travelPace === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div>
        <label className={sectionLabelClass}>💰 Budget Level</label>
        <div className={threeColGrid}>
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBudget(option.value)}
              className={optionPillClass(budget === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <label className={sectionLabelClass}>❤️ Interests (optional)</label>
        <div className="flex gap-2 flex-wrap mb-3">
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() =>
                setSelectedInterests((prev) =>
                  prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
                )
              }
              className={chipClass(selectedInterests.includes(interest))}
            >
              {interest}
            </button>
          ))}
          {selectedInterests.filter((i) => !(INTEREST_OPTIONS as readonly string[]).includes(i)).map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => handleRemoveInterest(interest)}
              className={chipClass(true, 'flex items-center gap-1.5')}
            >
              {interest}
              <span className="text-sm font-bold ml-0.5">×</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInterestInput}
            onChange={(e) => setCustomInterestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddCustomInterest(); }
            }}
            placeholder="Add other interests..."
            className={`${subtleInputClass} flex-1 text-[13px]`}
          />
          <button
            type="button"
            onClick={handleAddCustomInterest}
            className="px-4 py-2.5 rounded-[10px] border border-black/[0.18] bg-gray-100 cursor-pointer text-[13px] font-medium text-[#111]"
          >
            Add
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={sectionLabelClass}>📝 Additional Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., traveling with family, prefer walkable areas, budget constraints..."
          rows={2}
          className={`${subtleInputClass} resize-y min-h-[60px] bg-white text-[#111]`}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="px-4 py-3 rounded-xl border-none bg-blue-600 text-white cursor-pointer font-bold text-base mt-2 min-h-[48px]"
      >
        Generate Itinerary ✨
      </button>
    </form>
  );
}

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
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        background: 'white',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: 10,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 10,
        maxHeight: 200,
        overflow: 'auto',
      }}
    >
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onClick={() => onSelect(s.place_name)}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: 13,
            color: '#111',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            outline: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          🌍 {s.place_name}
        </button>
      ))}
    </div>
  );

  // ── Shared input style ────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '2px solid rgba(0,0,0,0.25)',
    fontSize: 14,
    boxSizing: 'border-box',
    minHeight: 44,
    backgroundColor: '#fff',
    color: '#111',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: '#fee2e2',
            color: '#991b1b',
            fontSize: 14,
            border: '1px solid #fecaca',
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* When are you traveling? */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          📅 When are you traveling?
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {/* Arrival date + time */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, color: '#111' }}>
              Arrival Date
            </label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              required
              style={{ ...inputStyle, colorScheme: 'light', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['morning', 'afternoon', 'night'] as const).map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setArrivalTime(time)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6,
                    border: '2px solid rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: arrivalTime === time ? '#0066cc' : '#f5f5f5',
                    color: arrivalTime === time ? '#fff' : '#111',
                    transition: 'all 0.2s',
                  }}
                >
                  {time.charAt(0).toUpperCase() + time.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Departure date + time */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, color: '#111' }}>
              Departure Date
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              required
              style={{ ...inputStyle, colorScheme: 'light', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['morning', 'afternoon', 'night'] as const).map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setDepartureTime(time)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6,
                    border: '2px solid rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: departureTime === time ? '#0066cc' : '#f5f5f5',
                    color: departureTime === time ? '#fff' : '#111',
                    transition: 'all 0.2s',
                  }}
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
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          📍 Where are you going?
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {/* Arrival location */}
          <div style={{ position: 'relative' }} ref={arrivalRef}>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, color: '#111' }}>
              Arrival Location
            </label>
            <input
              type="text"
              value={arrivalLocation}
              onChange={(e) => setArrivalLocation(e.target.value)}
              onFocus={() => { setIsArrivalFocused(true); arrivalLocation.trim() && setShowArrivalSuggestions(true); }}
              onBlur={() => setIsArrivalFocused(false)}
              placeholder="e.g., Barcelona, Spain"
              required
              style={inputStyle}
            />
            {showArrivalSuggestions && arrivalSuggestions.length > 0 && isArrivalFocused && (
              <SuggestionDropdown
                suggestions={arrivalSuggestions}
                onSelect={(name) => { setArrivalLocation(name); setShowArrivalSuggestions(false); setIsArrivalFocused(false); }}
              />
            )}
          </div>
          {/* Departure location */}
          <div style={{ position: 'relative' }} ref={departureRef}>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, color: '#111' }}>
              Departure Location
            </label>
            <input
              type="text"
              value={departureLocation}
              onChange={(e) => setDepartureLocation(e.target.value)}
              onFocus={() => { setIsDepartureFocused(true); departureLocation.trim() && setShowDepartureSuggestions(true); }}
              onBlur={() => setIsDepartureFocused(false)}
              placeholder="e.g., Barcelona, Spain"
              required
              style={inputStyle}
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
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          🛑 Stops Along the Way (optional)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative' }} ref={stopRef}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={currentStop}
                onChange={(e) => setCurrentStop(e.target.value)}
                onFocus={() => { setIsStopFocused(true); currentStop.trim() && setShowStopSuggestions(true); }}
                onBlur={() => setIsStopFocused(false)}
                placeholder="e.g., Valencia, Spain"
                style={inputStyle}
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
                style={{
                  padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: '#2563eb', color: 'white', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, minHeight: 44, minWidth: 44, flexShrink: 0,
                }}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stops.map((stop, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: '#f3f4f6',
                    borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>#{index + 1}</span>
                    <span style={{ fontSize: 13, color: '#111' }}>🌍 {stop}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStops((prev) => prev.filter((_, i) => i !== index))}
                    style={{
                      padding: '4px 8px', borderRadius: 6, border: 'none',
                      background: 'transparent', color: '#dc2626', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, outline: 'none',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
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
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          🎯 Places to visit (optional)
        </label>
        <textarea
          value={attractions}
          onChange={(e) => setAttractions(e.target.value)}
          placeholder="e.g., Sagrada Familia, Park Güell, Gothic Quarter (separate by comma)"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.18)', fontSize: 14, fontFamily: 'inherit',
            boxSizing: 'border-box', resize: 'vertical', minHeight: 80,
            backgroundColor: 'white', color: '#111',
          }}
        />
      </div>

      {/* Travel Pace */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          ⚡ Travel Pace
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
          {TRAVEL_PACE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTravelPace(option.value)}
              style={{
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, minHeight: 44,
                border: travelPace === option.value ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.18)',
                background: travelPace === option.value ? '#eff6ff' : 'white',
                fontWeight: travelPace === option.value ? 600 : 500,
                color: travelPace === option.value ? '#2563eb' : '#111',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          💰 Budget Level
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBudget(option.value)}
              style={{
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, minHeight: 44,
                border: budget === option.value ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.18)',
                background: budget === option.value ? '#eff6ff' : 'white',
                fontWeight: budget === option.value ? 600 : 500,
                color: budget === option.value ? '#2563eb' : '#111',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          ❤️ Interests (optional)
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() =>
                setSelectedInterests((prev) =>
                  prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
                )
              }
              style={{
                padding: '8px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
                border: selectedInterests.includes(interest) ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.18)',
                background: selectedInterests.includes(interest) ? '#dbeafe' : 'white',
                fontWeight: selectedInterests.includes(interest) ? 600 : 500,
                color: selectedInterests.includes(interest) ? '#2563eb' : '#111',
              }}
            >
              {interest}
            </button>
          ))}
          {selectedInterests.filter((i) => !(INTEREST_OPTIONS as readonly string[]).includes(i)).map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => handleRemoveInterest(interest)}
              style={{
                padding: '8px 12px', borderRadius: 20, border: '2px solid #2563eb',
                background: '#dbeafe', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: '#2563eb', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {interest}
              <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 2 }}>×</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={customInterestInput}
            onChange={(e) => setCustomInterestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddCustomInterest(); }
            }}
            placeholder="Add other interests..."
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.18)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={handleAddCustomInterest}
            style={{
              padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)',
              background: '#f3f4f6', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#111',
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: '#111' }}>
          📝 Additional Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., traveling with family, prefer walkable areas, budget constraints..."
          rows={2}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.18)', fontSize: 14, fontFamily: 'inherit',
            boxSizing: 'border-box', resize: 'vertical', minHeight: 60,
            backgroundColor: 'white', color: '#111',
          }}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        style={{
          padding: '12px 16px', borderRadius: 12, border: 'none', background: '#2563eb',
          color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 16, marginTop: 8, minHeight: 48,
        }}
      >
        Generate Itinerary ✨
      </button>
    </form>
  );
}

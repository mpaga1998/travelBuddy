import { useState, useEffect, useRef } from 'react';
import type { ItineraryInput } from './types';
import { generateItinerary } from './itineraryApi';
import { supabase } from '../../lib/supabaseClient';

interface ItineraryModalProps {
  open: boolean;
  onClose: () => void;
}

interface LocationSuggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

const TRAVEL_PACE_OPTIONS = [
  { value: 'relaxed', label: 'Relaxed (few activities per day)' },
  { value: 'moderate', label: 'Moderate (balanced pace)' },
  { value: 'active', label: 'Active (packed itinerary)' },
];

const BUDGET_OPTIONS = [
  { value: 'budget', label: '💰 Budget-friendly' },
  { value: 'mid-range', label: '💰💰 Mid-range' },
  { value: 'luxury', label: '💰💰💰 Luxury' },
];

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
];

export function ItineraryModal({ open, onClose }: ItineraryModalProps) {
  const [step, setStep] = useState<'form' | 'loading' | 'result'>('form');
  const [error, setError] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  // Form state
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [attractions, setAttractions] = useState('');
  const [travelPace, setTravelPace] = useState<'relaxed' | 'moderate' | 'active'>('moderate');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState<'budget' | 'mid-range' | 'luxury'>('mid-range');
  const [notes, setNotes] = useState('');

  // Location autocomplete state
  const [arrivalSuggestions, setArrivalSuggestions] = useState<LocationSuggestion[]>([]);
  const [departureSuggestions, setDepartureSuggestions] = useState<LocationSuggestion[]>([]);
  const [showArrivalSuggestions, setShowArrivalSuggestions] = useState(false);
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const [isArrivalFocused, setIsArrivalFocused] = useState(false);
  const [isDepartureFocused, setIsDepartureFocused] = useState(false);
  const arrivalRef = useRef<HTMLDivElement>(null);
  const departureRef = useRef<HTMLDivElement>(null);
  
  // Stops state
  const [stops, setStops] = useState<string[]>([]);
  const [currentStop, setCurrentStop] = useState('');
  const [stopSuggestions, setStopSuggestions] = useState<LocationSuggestion[]>([]);
  const [showStopSuggestions, setShowStopSuggestions] = useState(false);
  const [isStopFocused, setIsStopFocused] = useState(false);
  const stopRef = useRef<HTMLDivElement>(null);
  
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

  // Get current user ID and name when modal opens
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('👤 Current user from auth:', user.id);
        setCurrentUserId(user.id);
        
        // Fetch user's first name from profile
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', user.id)
            .single();
          
          if (error) {
            console.error('❌ Error fetching profile:', error);
          } else if (profile?.first_name) {
            console.log('✅ Profile name fetched:', profile.first_name);
            setCurrentUserName(profile.first_name);
          }
        } catch (err) {
          console.error('❌ Exception fetching profile:', err);
        }
      } else {
        console.log('⚠️ No user logged in');
      }
    };
    
    if (open) {
      getCurrentUser();
    }
  }, [open]);

  // Fetch location suggestions as user types
  useEffect(() => {
    if (!arrivalLocation.trim()) {
      setArrivalSuggestions([]);
      setShowArrivalSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            arrivalLocation
          )}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          setArrivalSuggestions(
            data.features.map((feature: any) => ({
              id: feature.id,
              place_name: feature.place_name,
              center: feature.geometry.coordinates,
            }))
          );
          setShowArrivalSuggestions(true);
        } else {
          setArrivalSuggestions([]);
        }
      } catch (error) {
        console.error("Arrival suggestions fetch failed:", error);
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
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            departureLocation
          )}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          setDepartureSuggestions(
            data.features.map((feature: any) => ({
              id: feature.id,
              place_name: feature.place_name,
              center: feature.geometry.coordinates,
            }))
          );
          setShowDepartureSuggestions(true);
        } else {
          setDepartureSuggestions([]);
        }
      } catch (error) {
        console.error("Departure suggestions fetch failed:", error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [departureLocation, mapboxToken]);

  // Fetch stop suggestions as user types
  useEffect(() => {
    if (!currentStop.trim()) {
      setStopSuggestions([]);
      setShowStopSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            currentStop
          )}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          setStopSuggestions(
            data.features.map((feature: any) => ({
              id: feature.id,
              place_name: feature.place_name,
              center: feature.geometry.coordinates,
            }))
          );
          setShowStopSuggestions(true);
        } else {
          setStopSuggestions([]);
        }
      } catch (error) {
        console.error("Stop suggestions fetch failed:", error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [currentStop, mapboxToken]);

  // Close suggestions when clicking outside
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep('loading');

    try {
      // Parse attractions from comma-separated string
      const attractionsList = attractions
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const input: ItineraryInput = {
        userId: currentUserId || undefined,
        userFirstName: currentUserName || undefined,
        arrival: {
          date: arrivalDate,
          location: arrivalLocation,
        },
        departure: {
          date: departureDate,
          location: departureLocation,
        },
        stops: stops.length > 0 ? stops : undefined,
        desiredAttractions: attractionsList,
        travelPace,
        interests: selectedInterests.length > 0 ? selectedInterests : undefined,
        budget,
        notes: notes.trim() || undefined,
      };

      console.log('📤 Sending itinerary request with userId:', input.userId, 'and name:', input.userFirstName);
      const result = await generateItinerary(input);
      setItinerary(result);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('form');
    }
  };

  const resetForm = () => {
    setStep('form');
    setError(null);
    setItinerary('');
    setArrivalDate('');
    setArrivalLocation('');
    setDepartureDate('');
    setDepartureLocation('');
    setStops([]);
    setCurrentStop('');
    setAttractions('');
    setTravelPace('moderate');
    setSelectedInterests([]);
    setBudget('mid-range');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
        zIndex: 1001,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 'min(600px, 100%)',
          background: 'white',
          borderRadius: isMobile ? '16px 16px 0 0' : 16,
          maxHeight: isMobile ? '90vh' : 'auto',
          overflow: 'auto',
          boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: isMobile ? '16px' : '20px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#111' }}>
              ✈️ Plan Your Itinerary
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#666' }}>
              Trip Details
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: 'pointer',
              padding: '4px 8px',
              color: '#999',
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '20px' }}>
          {step === 'form' && (
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

              {/* Trip Duration Section */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  📅 When are you traveling?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: 6, color: '#111' }}>
                      Arrival Date
                    </label>
                    <input
                      type="date"
                      value={arrivalDate}
                      onChange={(e) => setArrivalDate(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '2px solid rgba(0,0,0,0.25)',
                        fontSize: 14,
                        boxSizing: 'border-box',
                        minHeight: 44,
                        backgroundColor: '#fff',
                        color: '#111',
                        colorScheme: 'light',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: 6, color: '#111' }}>
                      Departure Date
                    </label>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '2px solid rgba(0,0,0,0.25)',
                        fontSize: 14,
                        boxSizing: 'border-box',
                        minHeight: 44,
                        backgroundColor: '#fff',
                        color: '#111',
                        colorScheme: 'light',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Locations */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  📍 Where are you going?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div style={{ position: 'relative' }} ref={arrivalRef}>
                    <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: 6, color: '#111' }}>
                      Arrival Location
                    </label>
                    <input
                      type="text"
                      value={arrivalLocation}
                      onChange={(e) => setArrivalLocation(e.target.value)}
                      onFocus={() => {
                        setIsArrivalFocused(true);
                        arrivalLocation.trim() && setShowArrivalSuggestions(true);
                      }}
                      onBlur={() => setIsArrivalFocused(false)}
                      placeholder="e.g., Barcelona, Spain"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '2px solid rgba(0,0,0,0.25)',
                        fontSize: 14,
                        boxSizing: 'border-box',
                        minHeight: 44,
                        backgroundColor: '#fff',
                        color: '#111',
                      }}
                    />
                    {showArrivalSuggestions && arrivalSuggestions.length > 0 && isArrivalFocused && (
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
                        {arrivalSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onTouchStart={(e) => e.preventDefault()}
                            onClick={() => {
                              setArrivalLocation(suggestion.place_name);
                              setShowArrivalSuggestions(false);
                              setIsArrivalFocused(false);
                            }}
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
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            }}
                          >
                            🌍 {suggestion.place_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position: 'relative' }} ref={departureRef}>
                    <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: 6, color: '#111' }}>
                      Departure Location
                    </label>
                    <input
                      type="text"
                      value={departureLocation}
                      onChange={(e) => setDepartureLocation(e.target.value)}
                      onFocus={() => {
                        setIsDepartureFocused(true);
                        departureLocation.trim() && setShowDepartureSuggestions(true);
                      }}
                      onBlur={() => setIsDepartureFocused(false)}
                      placeholder="e.g., Barcelona, Spain"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '2px solid rgba(0,0,0,0.25)',
                        fontSize: 14,
                        boxSizing: 'border-box',
                        minHeight: 44,
                        backgroundColor: '#fff',
                        color: '#111',
                      }}
                    />
                    {showDepartureSuggestions && departureSuggestions.length > 0 && isDepartureFocused && (
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
                        {departureSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onTouchStart={(e) => e.preventDefault()}
                            onClick={() => {
                              setDepartureLocation(suggestion.place_name);
                              setShowDepartureSuggestions(false);
                              setIsDepartureFocused(false);
                            }}
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
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            }}
                          >
                            🌍 {suggestion.place_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attractions */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  🛑 Stops Along the Way (optional)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Stop Input */}
                  <div style={{ position: 'relative' }} ref={stopRef}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={currentStop}
                        onChange={(e) => setCurrentStop(e.target.value)}
                        onFocus={() => {
                          setIsStopFocused(true);
                          currentStop.trim() && setShowStopSuggestions(true);
                        }}
                        onBlur={() => setIsStopFocused(false)}
                        placeholder="e.g., Valencia, Spain"
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '2px solid rgba(0,0,0,0.25)',
                          fontSize: 14,
                          boxSizing: 'border-box',
                          minHeight: 44,
                          backgroundColor: '#fff',
                          color: '#111',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (currentStop.trim()) {
                            setStops([...stops, currentStop.trim()]);
                            setCurrentStop('');
                            setShowStopSuggestions(false);
                          }
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: 'none',
                          background: '#2563eb',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 600,
                          minHeight: 44,
                          minWidth: 44,
                          flexShrink: 0,
                        }}
                      >
                        +
                      </button>
                    </div>
                    {showStopSuggestions && stopSuggestions.length > 0 && isStopFocused && (
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
                        {stopSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onTouchStart={(e) => e.preventDefault()}
                            onClick={() => {
                              setCurrentStop(suggestion.place_name);
                              setShowStopSuggestions(false);
                              setIsStopFocused(false);
                            }}
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
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            }}
                          >
                            🌍 {suggestion.place_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stops List */}
                  {stops.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {stops.map((stop, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: '#f3f4f6',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.1)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>#{index + 1}</span>
                            <span style={{ fontSize: 13, color: '#111' }}>🌍 {stop}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStops(stops.filter((_, i) => i !== index))}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: 'none',
                              background: 'transparent',
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                              outline: 'none',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            }}
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
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  🎯 Places to visit (optional)
                </label>
                <textarea
                  value={attractions}
                  onChange={(e) => setAttractions(e.target.value)}
                  placeholder="e.g., Sagrada Familia, Park Güell, Gothic Quarter (separate by comma)"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.18)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    minHeight: 80,
                    backgroundColor: 'white',
                    color: '#111',
                  }}
                />
              </div>

              {/* Travel Pace */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  ⚡ Travel Pace
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
                  {TRAVEL_PACE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTravelPace(option.value as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: travelPace === option.value ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.18)',
                        background: travelPace === option.value ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: travelPace === option.value ? 600 : 500,
                        color: travelPace === option.value ? '#2563eb' : '#111',
                        minHeight: 44,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  💰 Budget Level
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
                  {BUDGET_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBudget(option.value as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: budget === option.value ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.18)',
                        background: budget === option.value ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: budget === option.value ? 600 : 500,
                        color: budget === option.value ? '#2563eb' : '#111',
                        minHeight: 44,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  ❤️ Interests (optional)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {INTEREST_OPTIONS.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => {
                        setSelectedInterests((prev) =>
                          prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
                        );
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 20,
                        border: selectedInterests.includes(interest)
                          ? '2px solid #2563eb'
                          : '1px solid rgba(0,0,0,0.18)',
                        background: selectedInterests.includes(interest) ? '#dbeafe' : 'white',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: selectedInterests.includes(interest) ? 600 : 500,
                        color: selectedInterests.includes(interest) ? '#2563eb' : '#111',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  📝 Additional Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., traveling with family, prefer walkable areas, budget constraints..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.18)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    minHeight: 60,
                    backgroundColor: 'white',
                    color: '#111',
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#2563eb',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 16,
                  marginTop: 8,
                  minHeight: 48,
                }}
              >
                Generate Itinerary ✨
              </button>
            </form>
          )}

          {step === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
              <div style={{ fontSize: 32 }}>✨</div>
              <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', color: '#111' }}>
                Creating the best itinerary for you...
              </div>
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: '4px solid #e5e7eb',
                  borderTop: '4px solid #2563eb',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {step === 'result' && (
            <div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: '#333',
                  fontFamily: '"Segoe UI", system-ui, sans-serif',
                  paddingBottom: 20,
                }}
              >
                {/* Render markdown as HTML - precise formatting */}
                {itinerary.split('\n').map((line, idx) => {
                  // Headers
                  if (line.startsWith('###')) {
                    return (
                      <h3 key={idx} style={{ marginTop: 20, marginBottom: 10, fontSize: 16, fontWeight: 700 }}>
                        {line.replace(/^#+\s/, '')}
                      </h3>
                    );
                  }
                  if (line.startsWith('##')) {
                    return (
                      <h2 key={idx} style={{ marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>
                        {line.replace(/^#+\s/, '')}
                      </h2>
                    );
                  }
                  if (line.startsWith('#')) {
                    return (
                      <h1 key={idx} style={{ marginTop: 28, marginBottom: 14, fontSize: 20, fontWeight: 700 }}>
                        {line.replace(/^#+\s/, '')}
                      </h1>
                    );
                  }

                  let content = line;
                  if (content.trim() === '') {
                    return <div key={idx} style={{ height: 8 }} />;
                  }

                  // Helper function to render inline markdown (bold and italic)
                  const renderInlineMarkdown = (text: string) => {
                    // Split by bold first (**text**)
                    const boldParts = text.split(/(\*\*[^*]+\*\*)/);
                    
                    return boldParts.map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        // Bold text
                        const boldContent = part.slice(2, -2);
                        // Now handle italics within bold
                        const italicParts = boldContent.split(/(\*[^*]+\*)/);
                        return (
                          <strong key={i}>
                            {italicParts.map((segment, j) => {
                              if (segment.startsWith('*') && segment.endsWith('*') && segment.length > 2) {
                                return <em key={j}>{segment.slice(1, -1)}</em>;
                              }
                              return segment;
                            })}
                          </strong>
                        );
                      }
                      // Handle italics in non-bold text (*text*)
                      const italicParts = part.split(/(\*[^*]+\*)/);
                      return italicParts.map((segment, j) => {
                        if (segment.startsWith('*') && segment.endsWith('*') && segment.length > 2) {
                          return <em key={j}>{segment.slice(1, -1)}</em>;
                        }
                        return segment;
                      });
                    });
                  };

                  // Bullet lists - only if starts with - or * followed by space
                  if (/^[-]\s/.test(line)) {
                    const bulletContent = line.replace(/^-\s/, '');
                    return (
                      <div key={idx} style={{ marginLeft: 20, marginBottom: 4, display: 'flex', gap: 8 }}>
                        <span>•</span>
                        <span>{renderInlineMarkdown(bulletContent)}</span>
                      </div>
                    );
                  }

                  // Numbered lists
                  const numberMatch = line.match(/^\d+\.\s/);
                  if (numberMatch) {
                    const listContent = line.replace(/^\d+\.\s/, '');
                    const numberPart = line.match(/^\d+\./)?.[0];
                    return (
                      <div key={idx} style={{ marginLeft: 20, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{numberPart}</span> {renderInlineMarkdown(listContent)}
                      </div>
                    );
                  }

                  return (
                    <div key={idx} style={{ marginBottom: 8 }}>
                      {renderInlineMarkdown(content)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: isMobile ? '16px' : '20px',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          {step === 'result' && (
            <>
              <button
                onClick={() => {
                  const text = itinerary;
                  navigator.clipboard.writeText(text);
                  alert('Itinerary copied to clipboard!');
                }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.18)',
                  background: 'white',
                  color: '#111',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  minHeight: 44,
                }}
              >
                📋 Copy
              </button>
              <button
                onClick={() => resetForm()}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#2563eb',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  minHeight: 44,
                }}
              >
                ✨ Create Another
              </button>
            </>
          )}
          <button
            onClick={handleClose}
            style={{
              flex: step === 'form' ? 1 : undefined,
              padding: '12px 16px',
              borderRadius: 10,
              border: step === 'form' ? 'none' : '1px solid rgba(0,0,0,0.18)',
              background: step === 'form' ? '#f3f4f6' : 'white',
              color: '#111',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              minHeight: 44,
            }}
          >
            {step === 'form' ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

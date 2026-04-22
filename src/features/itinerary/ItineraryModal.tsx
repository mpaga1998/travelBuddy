import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ItineraryInput } from './types';
import { generateItinerary, saveItineraryToProfile } from './itineraryApi';
import { extractItineraryPlaces, type ExtractedPlace } from './itineraryMapOverlay';
import { supabase } from '../../lib/supabaseClient';

interface ItineraryModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks "View on map". Places and arrivalLocation are passed to the parent map view. */
  onViewOnMap?: (places: ExtractedPlace[], arrivalLocation: string) => void;
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

export function ItineraryModal({ open, onClose, onViewOnMap }: ItineraryModalProps) {
  const [step, setStep] = useState<'form' | 'loading' | 'streaming' | 'result'>('form');
  const [error, setError] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtractingPlaces, setIsExtractingPlaces] = useState(false);

  // Form state
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
        // First name is now fetched server-side from the verified JWT — no
        // need to read/send it from the client.
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

      // NB: userId/userFirstName intentionally NOT sent - server uses the verified
      // JWT + the profiles table as the only sources of truth for identity.
      const input: ItineraryInput = {
        arrival: {
          date: arrivalDate,
          location: arrivalLocation,
          time: arrivalTime ? (arrivalTime as 'morning' | 'afternoon' | 'night') : undefined,
        },
        departure: {
          date: departureDate,
          location: departureLocation,
          time: departureTime ? (departureTime as 'morning' | 'afternoon' | 'night') : undefined,
        },
        stops: stops.length > 0 ? stops : undefined,
        desiredAttractions: attractionsList.length > 0 ? attractionsList : undefined,
        travelPace,
        interests: selectedInterests.length > 0 ? selectedInterests : undefined,
        budget,
        notes: notes.trim() || undefined,
      };

      console.log('📤 Sending itinerary request:', {
        arrival: `${input.arrival.location} on ${input.arrival.date} at ${input.arrival.time || 'unspecified'}`,
        departure: `${input.departure.location} on ${input.departure.date} at ${input.departure.time || 'unspecified'}`,
        stops: input.stops,
        attractions: input.desiredAttractions,
        travelPace: input.travelPace,
        budget: input.budget,
        interests: input.interests,
        notes: input.notes,
      });
      // Stream tokens straight into the result view so the user sees words
      // appear instead of staring at a 40-second spinner. The first delta
      // flips us from 'loading' -> 'streaming' so the content area mounts.
      setItinerary('');
      const result = await generateItinerary(input, (_delta, accumulated) => {
        setItinerary(accumulated);
        setStep((prev) => (prev === 'loading' ? 'streaming' : prev));
      });
      // Belt + suspenders: make sure we end on the final text in case any
      // trailing bytes escaped the onToken path.
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
    setArrivalTime('');
    setArrivalLocation('');
    setDepartureDate('');
    setDepartureTime('');
    setDepartureLocation('');
    setStops([]);
    setCurrentStop('');
    setAttractions('');
    setTravelPace('moderate');
    setSelectedInterests([]);
    setCustomInterestInput('');
    setBudget('mid-range');
    setNotes('');
  };

  const handleRemoveInterest = (interest: string) => {
    setSelectedInterests(selectedInterests.filter(i => i !== interest));
  };

  const handleAddCustomInterest = () => {
    const trimmedInterest = customInterestInput.trim();
    if (trimmedInterest && !selectedInterests.includes(trimmedInterest)) {
      setSelectedInterests([...selectedInterests, trimmedInterest]);
      setCustomInterestInput('');
    }
  };

  const handleSaveItinerary = async () => {
    if (!currentUserId) {
      alert('❌ User not authenticated');
      return;
    }

    // Prompt user for title
    const title = prompt('📌 Give your itinerary a title:', `${arrivalLocation} Adventure`);
    if (!title) return; // User cancelled

    setIsSaving(true);
    try {
      await saveItineraryToProfile(
        currentUserId,
        title,
        itinerary,
        {
          arrivalLocation,
          departureLocation,
          startDate: arrivalDate,
          endDate: departureDate,
          travelPace,
          budget,
          interests: selectedInterests,
        }
      );

      // Show success message
      alert('✨ Done! Your custom itinerary has been saved to your profile');
      resetForm();
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save itinerary';
      console.error('❌ Save error:', err);
      alert(`❌ ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewOnMap = async () => {
    if (!onViewOnMap) return;
    setIsExtractingPlaces(true);
    try {
      const places = await extractItineraryPlaces(itinerary, arrivalLocation);
      if (!places.length) {
        alert('No named places could be extracted from this itinerary.');
        return;
      }
      onViewOnMap(places, arrivalLocation);
      resetForm();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extract places';
      console.error('❌ View on map error:', err);
      alert(`❌ ${message}`);
    } finally {
      setIsExtractingPlaces(false);
    }
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
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['morning', 'afternoon', 'night'] as const).map((time) => (
                        <button
                          key={time}
                          onClick={() => setArrivalTime(time)}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            borderRadius: 6,
                            border: '2px solid rgba(0,0,0,0.2)',
                            fontSize: 12,
                            fontWeight: 600,
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
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['morning', 'afternoon', 'night'] as const).map((time) => (
                        <button
                          key={time}
                          onClick={() => setDepartureTime(time)}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            borderRadius: 6,
                            border: '2px solid rgba(0,0,0,0.2)',
                            fontSize: 12,
                            fontWeight: 600,
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
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
                  {/* Custom Interests Display */}
                  {selectedInterests.filter(i => !INTEREST_OPTIONS.includes(i)).map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => handleRemoveInterest(interest)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 20,
                        border: '2px solid #2563eb',
                        background: '#dbeafe',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#2563eb',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {interest}
                      <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 2 }}>×</span>
                    </button>
                  ))}
                </div>

                {/* Custom Interest Input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={customInterestInput}
                    onChange={(e) => setCustomInterestInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomInterest();
                      }
                    }}
                    placeholder="Add other interests..."
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(0,0,0,0.18)',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomInterest}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(0,0,0,0.18)',
                      background: '#f3f4f6',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#111',
                    }}
                  >
                    Add
                  </button>
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

          {(step === 'streaming' || step === 'result') && (
            <div>
              {step === 'streaming' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    marginBottom: 12,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 8,
                    color: '#1d4ed8',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid #bfdbfe',
                      borderTop: '2px solid #1d4ed8',
                      borderRadius: '50%',
                      animation: 'spin 0.9s linear infinite',
                      flexShrink: 0,
                    }}
                  />
                  <span>Writing your itinerary…</span>
                </div>
              )}
              <div
                className="itinerary-markdown"
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: '#333',
                  fontFamily: '"Segoe UI", system-ui, sans-serif',
                  paddingBottom: 20,
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Style headings to match previous look.
                    h1: ({ node: _n, ...props }: any) => (
                      <h1 style={{ marginTop: 28, marginBottom: 14, fontSize: 20, fontWeight: 700 }} {...props} />
                    ),
                    h2: ({ node: _n, ...props }: any) => (
                      <h2 style={{ marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: 700 }} {...props} />
                    ),
                    h3: ({ node: _n, ...props }: any) => (
                      <h3 style={{ marginTop: 20, marginBottom: 10, fontSize: 16, fontWeight: 700 }} {...props} />
                    ),
                    p: ({ node: _n, ...props }: any) => (
                      <p style={{ marginTop: 0, marginBottom: 10 }} {...props} />
                    ),
                    ul: ({ node: _n, ...props }: any) => (
                      <ul style={{ marginTop: 4, marginBottom: 10, paddingLeft: 20 }} {...props} />
                    ),
                    ol: ({ node: _n, ...props }: any) => (
                      <ol style={{ marginTop: 4, marginBottom: 10, paddingLeft: 20 }} {...props} />
                    ),
                    li: ({ node: _n, ...props }: any) => (
                      <li style={{ marginBottom: 4 }} {...props} />
                    ),
                    blockquote: ({ node: _n, ...props }: any) => (
                      <blockquote
                        style={{
                          borderLeft: '4px solid #bfdbfe',
                          background: '#eff6ff',
                          margin: '10px 0',
                          padding: '8px 12px',
                          color: '#1e3a8a',
                          borderRadius: 4,
                        }}
                        {...props}
                      />
                    ),
                    table: ({ node: _n, ...props }: any) => (
                      <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }} {...props} />
                      </div>
                    ),
                    th: ({ node: _n, ...props }: any) => (
                      <th
                        style={{
                          border: '1px solid #e5e7eb',
                          padding: '6px 10px',
                          background: '#f9fafb',
                          textAlign: 'left',
                          fontWeight: 600,
                        }}
                        {...props}
                      />
                    ),
                    td: ({ node: _n, ...props }: any) => (
                      <td style={{ border: '1px solid #e5e7eb', padding: '6px 10px' }} {...props} />
                    ),
                    a: ({ node: _n, href, children, ...props }: any) => {
                      // Preserve the on-demand geocoding behavior for mapbox: links
                      // (the prompt may emit these for venue names).
                      if (href?.startsWith('mapbox:')) {
                        const match = href.match(/^mapbox:(.+)\|(.+)$/);
                        const decodedVenue = match ? decodeURIComponent(match[1]) : String(children);
                        const city = match ? match[2] : '';
                        return (
                          <a
                            href="#"
                            onClick={async (e) => {
                              e.preventDefault();
                              try {
                                const { geocodeVenue, generateGoogleMapsURL } = await import(
                                  '../../lib/venueGeocoding'
                                );
                                const coords = await geocodeVenue(decodedVenue, city);
                                const mapsUrl = generateGoogleMapsURL(coords, decodedVenue);
                                if (mapsUrl) window.open(mapsUrl, '_blank');
                              } catch (err) {
                                console.error('Failed to geocode:', err);
                                window.open(
                                  `https://www.google.com/maps/search/${encodeURIComponent(decodedVenue)}`,
                                  '_blank'
                                );
                              }
                            }}
                            style={{ color: '#0066cc', textDecoration: 'none', cursor: 'pointer' }}
                          >
                            {children}
                          </a>
                        );
                      }
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0066cc', textDecoration: 'none' }}
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {itinerary}
                </ReactMarkdown>
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
              {onViewOnMap && (
                <button
                  onClick={handleViewOnMap}
                  disabled={isExtractingPlaces || isSaving}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: isExtractingPlaces ? '#e5e7eb' : '#0ea5e9',
                    color: isExtractingPlaces ? '#111' : 'white',
                    cursor: (isExtractingPlaces || isSaving) ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    minHeight: 44,
                    opacity: (isExtractingPlaces || isSaving) ? 0.6 : 1,
                  }}
                >
                  {isExtractingPlaces ? '🗺️ Mapping…' : '📍 View on map'}
                </button>
              )}
              <button
                onClick={handleSaveItinerary}
                disabled={isSaving || isExtractingPlaces}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.18)',
                  background: isSaving ? '#e5e7eb' : 'white',
                  color: '#111',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  minHeight: 44,
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? '💾 Saving...' : '📌 Save to Profile'}
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

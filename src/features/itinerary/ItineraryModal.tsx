import { useState } from 'react';
import type { ItineraryInput } from './types';
import { generateItinerary } from './itineraryApi';

interface ItineraryModalProps {
  open: boolean;
  onClose: () => void;
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

      if (attractionsList.length === 0) {
        throw new Error('Please add at least one attraction');
      }

      const input: ItineraryInput = {
        arrival: {
          date: arrivalDate,
          location: arrivalLocation,
        },
        departure: {
          date: departureDate,
          location: departureLocation,
        },
        desiredAttractions: attractionsList,
        travelPace,
        interests: selectedInterests.length > 0 ? selectedInterests : undefined,
        budget,
        notes: notes.trim() || undefined,
      };

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
            alignItems: 'center',
            padding: isMobile ? '16px' : '20px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 700 }}>
            ✈️ Plan Your Itinerary
          </h2>
          <button
            onClick={handleClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: 'pointer',
              padding: '4px 8px',
              color: '#999',
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

              {/* Page Title */}
              <div style={{ marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: '#111' }}>Trip Details</h3>
              </div>

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
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: 6, color: '#111' }}>
                      Arrival Location
                    </label>
                    <input
                      type="text"
                      value={arrivalLocation}
                      onChange={(e) => setArrivalLocation(e.target.value)}
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
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: 6, color: '#111' }}>
                      Departure Location
                    </label>
                    <input
                      type="text"
                      value={departureLocation}
                      onChange={(e) => setDepartureLocation(e.target.value)}
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
                  </div>
                </div>
              </div>

              {/* Attractions */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 1, display: 'block', marginBottom: 12, color: '#111' }}>
                  🎯 Places to visit <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  value={attractions}
                  onChange={(e) => setAttractions(e.target.value)}
                  placeholder="e.g., Sagrada Familia, Park Güell, Gothic Quarter (separate by comma)"
                  required
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
              <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center' }}>
                Creating your perfect itinerary...
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
                {/* Render markdown as HTML - simple approach */}
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

                  // Bold and italic
                  let content = line;
                  if (content.trim() === '') {
                    return <div key={idx} style={{ height: 8 }} />;
                  }

                  // Bullet lists
                  if (line.startsWith('-') || line.startsWith('*')) {
                    return (
                      <div key={idx} style={{ marginLeft: 20, marginBottom: 4, display: 'flex', gap: 8 }}>
                        <span>•</span>
                        <span>{line.replace(/^[-*]\s/, '')}</span>
                      </div>
                    );
                  }

                  // Numbered lists
                  const numberMatch = line.match(/^\d+\.\s/);
                  if (numberMatch) {
                    return (
                      <div key={idx} style={{ marginLeft: 20, marginBottom: 4 }}>
                        {line}
                      </div>
                    );
                  }

                  return (
                    <div key={idx} style={{ marginBottom: 8 }}>
                      {line}
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

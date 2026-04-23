import { useState, useEffect } from 'react';
import { saveItineraryToProfile } from './itineraryApi';
import { supabase } from '../../lib/supabaseClient';
import { useItineraryDraft } from './hooks/useItineraryDraft';
import { ItineraryForm } from './ItineraryForm';
import { ItineraryPreview } from './ItineraryPreview';
import type { ItineraryInput } from './types';

interface ItineraryModalProps {
  open: boolean;
  onClose: () => void;
}

export function ItineraryModal({ open, onClose }: ItineraryModalProps) {
  const draft = useItineraryDraft();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    })();
  }, [open]);

  if (!open) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleGenerate = (input: ItineraryInput) => {
    draft.generate(input);
  };

  const handleReset = () => {
    draft.reset();
    setFormKey((k) => k + 1);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSaveItinerary = async () => {
    if (!currentUserId) { alert('❌ User not authenticated'); return; }
    if (!draft.lastInput) return;

    const { lastInput } = draft;
    const title = prompt('📌 Give your itinerary a title:', `${lastInput.arrival.location} Adventure`);
    if (!title) return;

    setIsSaving(true);
    try {
      await saveItineraryToProfile(
        currentUserId,
        title,
        draft.markdown,
        {
          arrivalLocation: lastInput.arrival.location,
          departureLocation: lastInput.departure.location,
          startDate: lastInput.arrival.date,
          endDate: lastInput.departure.date,
          travelPace: lastInput.travelPace,
          budget: lastInput.budget,
          interests: lastInput.interests,
        }
      );
      alert('✨ Done! Your custom itinerary has been saved to your profile');
      handleReset();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save itinerary';
      console.error('Save error:', err);
      alert(`❌ ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const { step, markdown, error } = draft;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center', padding: isMobile ? 0 : 16, zIndex: 1001,
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
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            padding: isMobile ? '16px' : '20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0, gap: 12,
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
            style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', padding: '4px 8px', color: '#999', flexShrink: 0 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '20px' }}>
          {step === 'form' && (
            <ItineraryForm
              key={formKey}
              onSubmit={handleGenerate}
              error={error}
              isMobile={isMobile}
            />
          )}

          {step === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
              <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', color: '#111' }}>
                Creating the best itinerary for you...
              </div>
              <div
                style={{
                  width: 40, height: 40,
                  border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb',
                  borderRadius: '50%', animation: 'spin 1s linear infinite',
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {(step === 'streaming' || step === 'result') && (
            <ItineraryPreview markdown={markdown} isStreaming={step === 'streaming'} />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex', gap: 12,
            padding: isMobile ? '16px' : '20px',
            borderTop: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
          }}
        >
          {step === 'result' && (
            <>
              <button
                onClick={handleSaveItinerary}
                disabled={isSaving}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.18)',
                  background: isSaving ? '#e5e7eb' : 'white', color: '#111',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14, minHeight: 44, opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? '💾 Saving...' : '📌 Save to Profile'}
              </button>
              <button
                onClick={handleReset}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none',
                  background: '#2563eb', color: 'white', cursor: 'pointer',
                  fontWeight: 600, fontSize: 14, minHeight: 44,
                }}
              >
                Create Another
              </button>
            </>
          )}
          <button
            onClick={handleClose}
            style={{
              flex: step === 'form' ? 1 : undefined,
              padding: '12px 16px', borderRadius: 10,
              border: step === 'form' ? 'none' : '1px solid rgba(0,0,0,0.18)',
              background: step === 'form' ? '#f3f4f6' : 'white',
              color: '#111', cursor: 'pointer', fontWeight: 600, fontSize: 14, minHeight: 44,
            }}
          >
            {step === 'form' ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
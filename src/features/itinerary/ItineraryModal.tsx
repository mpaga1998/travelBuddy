import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { saveItineraryToProfile } from './itineraryApi';
import { supabase } from '../../lib/supabaseClient';
import { useItineraryDraft } from './hooks/useItineraryDraft';
import { ItineraryForm } from './ItineraryForm';
import { ItineraryPreview } from './ItineraryPreview';
import { usePrompt } from '../../components/PromptDialog';
import type { ItineraryInput } from './types';

interface ItineraryModalProps {
  open: boolean;
  onClose: () => void;
}

export function ItineraryModal({ open, onClose }: ItineraryModalProps) {
  const draft = useItineraryDraft();
  const prompt = usePrompt();
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
    if (!currentUserId) {
      toast.error('You need to sign in first to save itineraries.');
      return;
    }
    if (!draft.lastInput) return;

    const { lastInput } = draft;
    const title = await prompt({
      title: '📌 Name your itinerary',
      message: 'Give it a memorable title so you can find it again later.',
      defaultValue: `${lastInput.arrival.location} Adventure`,
      placeholder: 'e.g. Lisbon long weekend',
      confirmLabel: 'Save',
      maxLength: 80,
    });
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
      toast.success('Itinerary saved to your profile');
      handleReset();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save itinerary';
      console.error('Save error:', err);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const { step, markdown, error } = draft;

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 bg-black/40 flex justify-center z-[1001] ${isMobile ? 'items-end p-0' : 'items-center p-4'}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)] flex flex-col ${isMobile ? 'w-full rounded-t-2xl max-h-[90vh] overflow-auto' : 'w-[min(600px,100%)] rounded-2xl overflow-auto'}`}
      >
        {/* Header */}
        <div
          className={`flex justify-between items-start border-b border-black/[0.08] flex-shrink-0 gap-3 ${isMobile ? 'p-4' : 'p-5'}`}
        >
          <div className="flex-1">
            <h2 className={`m-0 font-bold text-slate-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
              ✈️ Plan Your Itinerary
            </h2>
            <p className={`mt-1.5 font-semibold text-gray-500 ${isMobile ? 'text-xs' : 'text-[13px]'}`}>
              Trip Details
            </p>
          </div>
          <button
            onClick={handleClose}
            className="border-none bg-transparent text-2xl cursor-pointer px-2 py-1 text-gray-400 flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-auto ${isMobile ? 'p-4' : 'p-5'}`}>
          {step === 'form' && (
            <ItineraryForm
              key={formKey}
              onSubmit={handleGenerate}
              error={error}
              isMobile={isMobile}
            />
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="text-base font-semibold text-center text-slate-900">
                Creating the best itinerary for you...
              </div>
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}

          {(step === 'streaming' || step === 'result') && (
            <ItineraryPreview markdown={markdown} isStreaming={step === 'streaming'} />
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex gap-3 border-t border-black/[0.08] flex-shrink-0 ${isMobile ? 'p-4' : 'p-5'}`}
        >
          {step === 'result' && (
            <>
              <button
                onClick={handleSaveItinerary}
                disabled={isSaving}
                className={`flex-1 px-4 py-3 rounded-[10px] border border-black/[0.18] text-slate-900 font-semibold text-sm min-h-[44px] ${isSaving ? 'bg-gray-200 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}`}
              >
                {isSaving ? '💾 Saving...' : '📌 Save to Profile'}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-3 rounded-[10px] border-none bg-blue-600 text-white cursor-pointer font-semibold text-sm min-h-[44px]"
              >
                Create Another
              </button>
            </>
          )}
          <button
            onClick={handleClose}
            className={`px-4 py-3 rounded-[10px] text-slate-900 cursor-pointer font-semibold text-sm min-h-[44px] ${step === 'form' ? 'flex-1 border-none bg-gray-100' : 'border border-black/[0.18] bg-white'}`}
          >
            {step === 'form' ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

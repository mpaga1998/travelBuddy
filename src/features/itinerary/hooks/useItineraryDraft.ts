import { useState } from 'react';
import type { ItineraryInput } from '../types';
import { generateItinerary } from '../itineraryApi';

export type DraftStep = 'form' | 'loading' | 'streaming' | 'result';

export interface ItineraryDraft {
  step: DraftStep;
  markdown: string;
  error: string | null;
  /** The trip input that produced the current markdown — used by the save flow. */
  lastInput: ItineraryInput | null;
  generate: (input: ItineraryInput) => Promise<void>;
  reset: () => void;
}

export function useItineraryDraft(): ItineraryDraft {
  const [step, setStep] = useState<DraftStep>('form');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<ItineraryInput | null>(null);

  const generate = async (input: ItineraryInput) => {
    setError(null);
    setStep('loading');
    setMarkdown('');
    setLastInput(input);

    console.log('📤 Sending itinerary request:', {
      arrival: `${input.arrival.location} on ${input.arrival.date} at ${input.arrival.time ?? 'unspecified'}`,
      departure: `${input.departure.location} on ${input.departure.date} at ${input.departure.time ?? 'unspecified'}`,
      stops: input.stops,
      attractions: input.desiredAttractions,
      travelPace: input.travelPace,
      budget: input.budget,
      interests: input.interests,
      notes: input.notes,
    });

    try {
      const result = await generateItinerary(input, (_delta, accumulated) => {
        setMarkdown(accumulated);
        setStep((prev) => (prev === 'loading' ? 'streaming' : prev));
      });
      // Belt + suspenders: ensure we end on the final text.
      setMarkdown(result);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('form');
    }
  };

  const reset = () => {
    setStep('form');
    setMarkdown('');
    setError(null);
    setLastInput(null);
  };

  return { step, markdown, error, lastInput, generate, reset };
}

/**
 * B2.2 + A1: Import a place from a social link.
 *
 * Six states:
 *   input   — URL field + platform guidance
 *   loading — spinner while the API works
 *   results — card list of geocoded candidates
 *   empty   — extraction succeeded but found no named places
 *   error   — network / moderation / unsupported platform
 *   saved   — place persisted to My Map; offers "share as public pin" (A1)
 *
 * On candidate selection the modal calls onPlaceSelected (parent pans the map
 * and writes saved_places), then stays open on the saved step so the user can
 * optionally publish the place as an attributed community pin via onShareAsPin.
 */

import { useRef, useState } from 'react';
import type { SocialCandidate, SocialAttribution } from './socialImportApi';
import {
  extractFromUrl,
  PlatformUnavailableError,
} from './socialImportApi';

// ── Type emoji helpers ────────────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  food: '🍽️',
  sight: '🏛️',
  nightlife: '🍸',
  shop: '🛍️',
  transport: '🚉',
  accommodation: '🏨',
  other: '📍',
};

const CONFIDENCE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Specific venue' },
  medium: { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Area / neighbourhood' },
  low:    { bg: 'bg-gray-100',    text: 'text-gray-600',    label: 'City only' },
};

// ── State machine ─────────────────────────────────────────────────────────────

type ModalStep =
  | { step: 'input' }
  | { step: 'loading' }
  | { step: 'results'; candidates: SocialCandidate[]; attribution: SocialAttribution; platform: string }
  | { step: 'empty';   attribution: SocialAttribution; platform: string }
  | { step: 'error';   message: string; platformUnavailable?: boolean }
  // A1: post-save step — the place is on My Map; offer to also publish it
  // as a public community pin (with attribution, per the B0.1 guardrail).
  | {
      step: 'saved';
      candidate: SocialCandidate;
      attribution: SocialAttribution;
      platform: string;
      shareState: 'offer' | 'sharing' | 'shared' | 'failed';
    };

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportFromLinkModalProps {
  onClose: () => void;
  /** Called when the user confirms a candidate. Parent pans map + saves to My Map. */
  onPlaceSelected: (candidate: SocialCandidate, attribution: SocialAttribution) => void;
  /**
   * A1: called when the user opts to also publish the saved place as a public
   * community pin. Parent handles moderation + createPin + reload. When
   * omitted, the share offer is hidden.
   */
  onShareAsPin?: (
    candidate: SocialCandidate,
    attribution: SocialAttribution,
    platform: string,
  ) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportFromLinkModal({
  onClose,
  onPlaceSelected,
  onShareAsPin,
}: ImportFromLinkModalProps) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<ModalStep>({ step: 'input' });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleExtract = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setState({ step: 'loading' });

    try {
      const result = await extractFromUrl(trimmed);
      if (result.candidates.length === 0) {
        setState({ step: 'empty', attribution: result.attribution, platform: result.platform });
      } else {
        setState({
          step: 'results',
          candidates: result.candidates,
          attribution: result.attribution,
          platform: result.platform,
        });
      }
    } catch (err) {
      setState({
        step: 'error',
        message:
          err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        platformUnavailable: err instanceof PlatformUnavailableError,
      });
    }
  };

  const handleReset = () => {
    setUrl('');
    setState({ step: 'input' });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
    } catch {
      // Clipboard not available — user can type manually
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && state.step === 'input') void handleExtract();
  };

  // A1: candidate tap — save to My Map (parent) and move to the share offer.
  const handleSelect = (candidate: SocialCandidate, attribution: SocialAttribution, platform: string) => {
    onPlaceSelected(candidate, attribution);
    setState({ step: 'saved', candidate, attribution, platform, shareState: 'offer' });
  };

  const handleShare = async () => {
    if (state.step !== 'saved' || !onShareAsPin) return;
    const { candidate, attribution, platform } = state;
    setState({ ...state, shareState: 'sharing' });
    try {
      await onShareAsPin(candidate, attribution, platform);
      setState({ step: 'saved', candidate, attribution, platform, shareState: 'shared' });
    } catch {
      // Parent surfaces the specific error (e.g. moderation) via toast.
      setState({ step: 'saved', candidate, attribution, platform, shareState: 'failed' });
    }
  };

  // ── Platform label ───────────────────────────────────────────────────────────

  const platformLabel = (p: string) =>
    p === 'tiktok' ? 'TikTok' : p === 'pinterest' ? 'Pinterest' : p;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import place from link"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className={`fixed inset-0 bg-black/40 flex justify-center z-[1002] ${
        isMobile ? 'items-end p-0' : 'items-center p-4'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)] flex flex-col ${
          isMobile
            ? 'w-full rounded-t-2xl max-h-[90vh] overflow-auto'
            : 'w-[min(520px,100%)] rounded-2xl overflow-auto'
        }`}
      >
        {/* Header */}
        <div
          className={`flex justify-between items-center border-b border-black/[0.08] flex-shrink-0 ${
            isMobile ? 'p-4' : 'p-5'
          }`}
        >
          <h2 className={`m-0 font-bold text-slate-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
            🔗 Import from link
          </h2>
          <button
            onClick={onClose}
            aria-label="Close import modal"
            className="border-none bg-transparent text-2xl cursor-pointer px-2 py-1 text-gray-400 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-auto ${isMobile ? 'p-4' : 'p-5'}`}>

          {/* ── Input step ─────────────────────────────────────────────── */}
          {state.step === 'input' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600 m-0">
                Paste a public post URL and nook will extract the places mentioned in it.
              </p>

              {/* Platform support pills */}
              <div className="flex gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  ✅ TikTok
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  ✅ Pinterest
                </span>
                <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-xs font-semibold border border-gray-200">
                  ⚠️ Instagram (coming soon)
                </span>
              </div>

              {/* URL input + paste */}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.stopPropagation(); void handleExtract(); }
                  }}
                  placeholder="https://www.tiktok.com/..."
                  autoFocus
                  className="flex-1 px-3 py-2.5 rounded-xl border border-black/[0.18] text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="px-3 py-2.5 rounded-xl border border-black/[0.18] bg-gray-50 text-slate-700 text-sm font-semibold cursor-pointer whitespace-nowrap min-h-[44px]"
                  title="Paste from clipboard"
                >
                  📋 Paste
                </button>
              </div>

              <p className="text-xs text-slate-400 m-0">
                Only public posts work. The post caption is scanned — no video is downloaded.
              </p>
            </div>
          )}

          {/* ── Loading step ───────────────────────────────────────────── */}
          {state.step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-600 text-center">
                Scanning link for places…
              </p>
            </div>
          )}

          {/* ── Results step ──────────────────────────────────────────── */}
          {state.step === 'results' && (
            <div className="flex flex-col gap-4">
              {/* Attribution strip */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-black/[0.08]">
                {state.attribution.thumbnailUrl && (
                  <img
                    src={state.attribution.thumbnailUrl}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="text-xs text-slate-600 leading-tight">
                  <span className="font-semibold text-slate-800">
                    {platformLabel(state.platform)}
                  </span>
                  {state.attribution.author && (
                    <> · @{state.attribution.author}</>
                  )}
                  <br />
                  <a
                    href={state.attribution.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View original post ↗
                  </a>
                </div>
              </div>

              <p className="text-sm text-slate-600 m-0">
                Found <strong>{state.candidates.length}</strong> place
                {state.candidates.length !== 1 ? 's' : ''}.
                Select one to see it on the map.
              </p>

              {/* Candidate cards */}
              <div className="flex flex-col gap-2.5">
                {state.candidates.map((c, idx) => {
                  const conf = CONFIDENCE_STYLE[c.confidence] ?? CONFIDENCE_STYLE.medium;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelect(c, state.attribution, state.platform)}
                      className="text-left px-4 py-3 rounded-xl border border-black/[0.12] bg-white hover:bg-slate-50 hover:border-blue-400 transition-colors cursor-pointer flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 text-sm leading-snug">
                          {TYPE_EMOJI[c.type] ?? '📍'} {c.name}
                        </span>
                        <span
                          className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${conf.bg} ${conf.text}`}
                        >
                          {conf.label}
                        </span>
                      </div>
                      {c.city && (
                        <span className="text-xs text-slate-500">{c.city}</span>
                      )}
                      <span className="text-xs text-slate-500 italic leading-relaxed line-clamp-2">
                        "{c.context}"
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Saved step (A1: share offer) ──────────────────────────── */}
          {state.step === 'saved' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="text-4xl">⭐</div>
              <p className="text-sm font-bold text-slate-900 m-0">
                {state.candidate.name} saved to My Map
              </p>

              {state.shareState === 'offer' && onShareAsPin && (
                <p className="text-xs text-slate-500 m-0 max-w-[320px] leading-relaxed">
                  Also share it as a <strong>public pin</strong> so other travelers can
                  find it? The pin will credit the original post
                  {state.attribution.author ? <> by <strong>@{state.attribution.author}</strong></> : null}.
                </p>
              )}

              {state.shareState === 'sharing' && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                  Publishing pin…
                </div>
              )}

              {state.shareState === 'shared' && (
                <p className="text-xs font-semibold text-emerald-700 m-0">
                  📌 Shared! Other travelers can now find this place.
                </p>
              )}

              {state.shareState === 'failed' && (
                <p className="text-xs text-red-600 m-0 max-w-[320px]">
                  Couldn't publish the pin — the place is still saved to My Map.
                </p>
              )}
            </div>
          )}

          {/* ── Empty step ────────────────────────────────────────────── */}
          {state.step === 'empty' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="text-4xl">🔍</div>
              <p className="text-sm font-semibold text-slate-800 m-0">
                No specific places found
              </p>
              <p className="text-xs text-slate-500 m-0 max-w-[300px]">
                The caption may be too vague. Try a post that names a specific
                restaurant, landmark, or hotel.
              </p>
              {state.attribution.sourceUrl && (
                <a
                  href={state.attribution.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View original post ↗
                </a>
              )}
            </div>
          )}

          {/* ── Error step ────────────────────────────────────────────── */}
          {state.step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="text-4xl">
                {state.platformUnavailable ? '⚠️' : '😕'}
              </div>
              <p className="text-sm font-semibold text-slate-800 m-0">
                {state.platformUnavailable ? 'Platform not available' : 'Something went wrong'}
              </p>
              <p className="text-xs text-slate-500 m-0 max-w-[320px] leading-relaxed">
                {state.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`border-t border-black/[0.08] flex-shrink-0 ${
            isMobile ? 'p-4' : 'p-5'
          } flex gap-3`}
        >
          {state.step === 'input' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-[10px] border-none bg-gray-100 text-slate-900 cursor-pointer font-semibold text-sm min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExtract()}
                disabled={!url.trim()}
                className={`flex-1 px-4 py-3 rounded-[10px] border-none text-white font-semibold text-sm min-h-[44px] ${
                  url.trim()
                    ? 'bg-blue-600 cursor-pointer hover:bg-blue-700'
                    : 'bg-blue-300 cursor-not-allowed'
                }`}
              >
                Find places →
              </button>
            </>
          )}

          {(state.step === 'results' || state.step === 'empty' || state.step === 'error') && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-4 py-3 rounded-[10px] border border-black/[0.18] bg-white text-slate-900 cursor-pointer font-semibold text-sm min-h-[44px]"
              >
                Try another link
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-[10px] border-none bg-gray-100 text-slate-900 cursor-pointer font-semibold text-sm min-h-[44px]"
              >
                Close
              </button>
            </>
          )}

          {state.step === 'loading' && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-[10px] border-none bg-gray-100 text-slate-900 cursor-pointer font-semibold text-sm min-h-[44px]"
            >
              Cancel
            </button>
          )}

          {/* A1: saved-step footer */}
          {state.step === 'saved' && (
            <>
              {(state.shareState === 'offer' || state.shareState === 'failed') && onShareAsPin && (
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="flex-1 px-4 py-3 rounded-[10px] border-none bg-blue-600 hover:bg-blue-700 text-white cursor-pointer font-semibold text-sm min-h-[44px]"
                >
                  {state.shareState === 'failed' ? '🔁 Try sharing again' : '📌 Share publicly'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={state.shareState === 'sharing'}
                className={`flex-1 px-4 py-3 rounded-[10px] border-none bg-gray-100 text-slate-900 font-semibold text-sm min-h-[44px] ${
                  state.shareState === 'sharing' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

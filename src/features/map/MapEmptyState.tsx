/**
 * Phase 9.3 — soft empty state shown when no pins are visible in the
 * current viewport. Not full-screen: the map stays fully interactive
 * behind the card. Disappears automatically once pins[] becomes non-empty.
 */
export function MapEmptyState({
  onPlanTrip,
  onDropPin,
}: {
  onPlanTrip: () => void;
  onDropPin: () => void;
}) {
  return (
    // Outer wrapper: pointer-events-none so the transparent gutter around
    // the card never swallows map touches. The card itself re-enables them.
    <div className="absolute inset-x-0 bottom-24 flex justify-center px-4 pointer-events-none z-10">
      <div className="pointer-events-auto w-full max-w-[340px] bg-white rounded-2xl shadow-md border border-black/[0.08] p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-[#111]">It&apos;s quiet here.</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Be the first to share a corner, or let nook plan a trip for you.
          </p>
        </div>

        {/* Two CTAs — stack on narrow, side-by-side on ≥480px */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDropPin}
            className="px-3 py-2 rounded-xl border border-black/[0.18] bg-white text-sm font-medium text-[#111] hover:bg-gray-50 active:scale-[0.98] transition-transform"
          >
            📍 Drop the first pin
          </button>
          <button
            type="button"
            onClick={onPlanTrip}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-transform"
          >
            🗺️ Plan a trip here
          </button>
        </div>
      </div>
    </div>
  );
}

/** Confirmation dialog before permanently deleting a public pin. */
export function DeleteConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete pin"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      tabIndex={-1}
      className="fixed inset-0 bg-black/35 flex items-center justify-center p-4 z-[9999]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(400px,100%)] bg-white rounded-2xl p-6 shadow-[0_18px_48px_rgba(0,0,0,0.22)] text-[#111] text-center"
      >
        <div className="text-[32px] mb-3">🗑️</div>
        <div className="font-extrabold text-base mb-2 leading-snug">
          Are you sure you want to delete your pin? 😢
        </div>
        <div className="text-sm opacity-85 mb-6">
          It looked like a great place!
        </div>
        <div className="flex gap-2.5 justify-center">
          <button
            onClick={onCancel}
            autoFocus
            className="px-4 py-2.5 rounded-[10px] border border-black/[0.18] bg-white text-[#111] cursor-pointer font-extrabold"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-[10px] border-none bg-red-600 text-white cursor-pointer font-extrabold"
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}

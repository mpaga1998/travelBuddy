import { useEffect, useRef } from "react";
import { Modal } from "../../../components/ui";

/** Sticky-note style popover showing a pin's tips list. */
export function TipsViewer({
  tips,
  isMobile,
  onClose,
}: {
  tips: string[];
  isMobile: boolean;
  onClose: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  return (
    <Modal
      onClose={onClose}
      label="Tips"
      zClassName="z-[10000]"
      backdropClassName="bg-transparent"
      panelBase={false}
      panelClassName={`bg-[#fff9e6] shadow-[0_10px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] rounded p-5 w-full relative -rotate-2 font-['Segoe_UI',Arial,sans-serif] text-[#333] ${
        isMobile ? "max-w-[85vw]" : "max-w-[380px]"
      }`}
    >
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close tips"
          className="absolute top-2 right-2 border-none bg-transparent text-xl cursor-pointer px-2 py-1 text-[#999] font-bold"
        >
          ✕
        </button>

        <div className="font-bold text-base mb-3.5 pr-6 text-[#222]">
          💡 Tips
        </div>

        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {tips.map((tip, idx) => (
            <li key={idx} className="flex gap-2.5 text-[13px] leading-normal text-[#333]">
              <span className="font-bold shrink-0">•</span>
              <span className="break-words">{tip}</span>
            </li>
          ))}
        </ul>
    </Modal>
  );
}

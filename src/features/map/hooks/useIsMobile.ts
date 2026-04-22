import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT } from "../mapConstants";

/** Reactive viewport check. Returns true when innerWidth < MOBILE_BREAKPOINT. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

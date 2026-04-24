import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

interface LoadingPageProps {
  onLoadingComplete: () => void;
}

export function LoadingPage({ onLoadingComplete }: LoadingPageProps) {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: session } = await supabase.auth.getSession();

      if (session?.session?.user?.user_metadata?.first_name) {
        setUserName(session.session.user.user_metadata.first_name);
      }
    };

    fetchUserName();

    // Show loading for 4 seconds then complete
    const timer = setTimeout(() => {
      onLoadingComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onLoadingComplete]);

  return (
    <div className="w-screen h-[100dvh] bg-gradient-to-br from-[#ff8c00] to-[#ff6b00] flex flex-col items-center justify-center text-white overflow-hidden font-sans">
      {/* Spinner */}
      <div className="w-[60px] h-[60px] border-4 border-white/30 border-t-white rounded-full animate-spin mb-8" />

      {/* Title */}
      <h1 className="text-[32px] font-bold m-0 mb-4 text-center">travelBuddy</h1>

      {/* Greeting if logged in */}
      {userName && (
        <p className="text-lg font-medium my-2 text-center opacity-95">
          Hi {userName}, ready for an adventure? 🎒
        </p>
      )}

      {!userName && (
        <p className="text-base font-normal my-2 text-center opacity-85">
          Loading your adventure...
        </p>
      )}
    </div>
  );
}

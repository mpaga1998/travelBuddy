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
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        background: "linear-gradient(135deg, #ff8c00 0%, #ff6b00 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: "60px",
          height: "60px",
          border: "4px solid rgba(255, 255, 255, 0.3)",
          borderTop: "4px solid white",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          marginBottom: "32px",
        }}
      />

      {/* Title */}
      <h1
        style={{
          fontSize: "32px",
          fontWeight: "bold",
          margin: "0 0 16px 0",
          textAlign: "center",
        }}
      >
        travelBuddy
      </h1>

      {/* Greeting if logged in */}
      {userName && (
        <p
          style={{
            fontSize: "18px",
            fontWeight: "500",
            margin: "8px 0",
            textAlign: "center",
            opacity: 0.95,
          }}
        >
          Hi {userName}, ready for an adventure? 🎒
        </p>
      )}

      {!userName && (
        <p
          style={{
            fontSize: "16px",
            fontWeight: "400",
            margin: "8px 0",
            textAlign: "center",
            opacity: 0.85,
          }}
        >
          Loading your adventure...
        </p>
      )}

      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}

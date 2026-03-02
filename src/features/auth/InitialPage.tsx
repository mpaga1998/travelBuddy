import { useState } from "react";

interface InitialPageProps {
  onGoToMap: () => void;
}

export function InitialPage({ onGoToMap }: InitialPageProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);

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
        padding: "20px",
        boxSizing: "border-box",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Logo / Icon */}
      <div
        style={{
          width: "80px",
          height: "80px",
          background: "white",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "48px",
          marginBottom: "32px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
        }}
      >
        🧭
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "36px",
          fontWeight: "bold",
          margin: "0 0 12px 0",
          textAlign: "center",
        }}
      >
        travelBuddy
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "16px",
          fontWeight: "400",
          margin: "0 0 48px 0",
          textAlign: "center",
          opacity: 0.95,
          maxWidth: "280px",
        }}
      >
        Discover amazing places and create unforgettable memories
      </p>

      {/* Buttons Container */}
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Button 1: Where Next? */}
        <button
          onClick={onGoToMap}
          style={{
            width: "100%",
            padding: "18px 20px",
            fontSize: "18px",
            fontWeight: "600",
            border: "none",
            borderRadius: "16px",
            background: "white",
            color: "#ff8c00",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            transition: "transform 0.2s, box-shadow 0.2s",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
          onTouchStart={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onTouchEnd={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          <span>🌍</span>
          <span>Where next?</span>
        </button>

        {/* Button 2: Create Itinerary */}
        <button
          onClick={() => setShowComingSoon(true)}
          style={{
            width: "100%",
            padding: "18px 20px",
            fontSize: "18px",
            fontWeight: "600",
            border: "none",
            borderRadius: "16px",
            background: "#ffd700",
            color: "#333",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            transition: "transform 0.2s, box-shadow 0.2s",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
          onTouchStart={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onTouchEnd={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          <span>✨</span>
          <span>Create your custom travel itinerary!</span>
        </button>
      </div>

      {/* Coming Soon Popup */}
      {showComingSoon && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
            boxSizing: "border-box",
          }}
          onClick={() => setShowComingSoon(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "32px 24px",
              maxWidth: "320px",
              textAlign: "center",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}
            >
              😉
            </div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                margin: "0 0 12px 0",
                color: "#333",
              }}
            >
              Coming Soon!
            </h2>
            <p
              style={{
                fontSize: "16px",
                color: "#666",
                margin: "0 0 24px 0",
                lineHeight: "1.5",
              }}
            >
              Be patient! This feature is coming soon...
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              style={{
                width: "100%",
                padding: "12px 20px",
                fontSize: "16px",
                fontWeight: "600",
                border: "none",
                borderRadius: "12px",
                background: "#ff8c00",
                color: "white",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#ff7700";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#ff8c00";
              }}
            >
              Got it! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

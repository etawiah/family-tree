import { useEffect, useState } from "react";

/**
 * Offline detection banner
 * Shows a banner at the top of the page when the user loses internet connection
 * Automatically hides when connection is restored
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => {
    // Initialize with current online status
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  useEffect(() => {
    /**
     * Handle online event
     */
    const handleOnline = () => {
      setIsOnline(true);
    };

    /**
     * Handle offline event
     */
    const handleOffline = () => {
      setIsOnline(false);
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: "#dc2626",
        color: "white",
        padding: "1rem",
        textAlign: "center",
        zIndex: 9999,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        animation: "slideDown 0.3s ease-out",
      }}
      role="alert"
      aria-live="assertive"
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <p style={{ margin: 0, fontWeight: "500" }}>
          You're offline. Some features may be unavailable.
        </p>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", opacity: 0.9 }}>
          Please check your internet connection.
        </p>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

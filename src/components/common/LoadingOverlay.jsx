/**
 * Loading overlay component for showing loading states with spinner.
 * Can optionally include a message.
 *
 * Usage:
 *   <LoadingOverlay isVisible={isLoading} message="Saving..." />
 */
export default function LoadingOverlay({ isVisible = false, message = "Loading..." }) {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        zIndex: 10000,
      }}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.5rem",
          padding: "2rem",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
          textAlign: "center",
          minWidth: "200px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "4px solid #e5e7eb",
            borderTop: "4px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem auto",
          }}
        />
        <p
          style={{
            margin: 0,
            color: "#374151",
            fontSize: "1rem",
            fontWeight: "500",
          }}
        >
          {message}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Reusable error display component with retry functionality.
 * Shows error messages with optional retry button and clear button.
 *
 * Usage:
 *   <ErrorDisplay
 *     error="Failed to load data"
 *     onRetry={handleRetry}
 *     onClear={handleClearError}
 *     canRetry={retryCount < MAX_RETRIES}
 *   />
 */
export default function ErrorDisplay({
  error,
  onRetry,
  onClear,
  canRetry = true,
  retryLabel = "Retry",
  clearLabel = "Dismiss",
}) {
  if (!error) return null;

  return (
    <div
      className="error-display"
      role="alert"
      aria-live="assertive"
      style={{
        marginBottom: "1.5rem",
        padding: "1rem",
        backgroundColor: "#fee2e2",
        border: "1px solid #fca5a5",
        borderRadius: "0.5rem",
        color: "#991b1b",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 0.5rem 0", fontWeight: "500" }}>
            Error
          </p>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>{error}</p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexShrink: 0,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {onRetry && canRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#991b1b";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#dc2626";
              }}
            >
              {retryLabel}
            </button>
          )}

          {onClear && (
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#fca5a5",
                color: "#7f1d1d",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#f87171";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#fca5a5";
              }}
            >
              {clearLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

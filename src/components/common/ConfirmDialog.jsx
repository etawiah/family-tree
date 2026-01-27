/**
 * Accessible confirmation dialog component for user confirmations.
 * Used for confirming destructive or important actions.
 *
 * Usage:
 *   <ConfirmDialog
 *     isOpen={showDialog}
 *     title="Delete person?"
 *     message="This action cannot be undone."
 *     confirmLabel="Delete"
 *     onConfirm={handleDelete}
 *     onCancel={handleCancel}
 *     isDangerous={true}
 *   />
 */
export default function ConfirmDialog({
  isOpen = false,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false,
}) {
  if (!isOpen) return null;

  const confirmButtonStyle = {
    padding: "0.75rem 1.5rem",
    backgroundColor: isDangerous ? "#dc2626" : "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "0.375rem",
    cursor: isLoading ? "not-allowed" : "pointer",
    fontSize: "1rem",
    fontWeight: "500",
    opacity: isLoading ? 0.5 : 1,
  };

  const cancelButtonStyle = {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#e5e7eb",
    color: "#374151",
    border: "none",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 10001,
      }}
      role="presentation"
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.5rem",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
          maxWidth: "400px",
          width: "90%",
          padding: "1.5rem",
        }}
        role="dialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-title"
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1.25rem",
            fontWeight: "600",
            color: isDangerous ? "#dc2626" : "#1f2937",
          }}
        >
          {title}
        </h2>

        <p
          id="confirm-message"
          style={{
            margin: "0.5rem 0 1.5rem 0",
            color: "#6b7280",
            lineHeight: "1.5",
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={cancelButtonStyle}
            disabled={isLoading}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#d1d5db";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#e5e7eb";
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={confirmButtonStyle}
            disabled={isLoading}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = isDangerous ? "#991b1b" : "#1e40af";
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = isDangerous ? "#dc2626" : "#3b82f6";
            }}
          >
            {isLoading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

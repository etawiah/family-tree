import { useEffect, useState } from "react";

/**
 * Toast notification component for user feedback.
 * 
 * Usage:
 *   const { showToast } = useToast();
 *   showToast("Success message", "success");
 *   showToast("Error message", "error");
 */
export function Toast({ message, type = "info", onClose, duration = 5000 }) {
  useEffect(() => {
    if (message && duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  const typeStyles = {
    success: { bg: "#10b981", color: "#ffffff" },
    error: { bg: "#ef4444", color: "#ffffff" },
    warning: { bg: "#f59e0b", color: "#ffffff" },
    info: { bg: "#3b82f6", color: "#ffffff" },
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div
      className="toast"
      style={{
        position: "fixed",
        bottom: "2rem",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: style.bg,
        color: style.color,
        padding: "1rem 1.5rem",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        zIndex: 10000,
        pointerEvents: "auto",
        maxWidth: "90%",
        minWidth: "300px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}
      role="alert"
      aria-live="polite"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: "1.2rem",
          padding: "0 0.5rem",
        }}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Hook for managing toast notifications.
 */
export function useToast() {
  const [toast, setToast] = useState({ message: "", type: "info" });

  const showToast = (message, type = "info", duration = 5000) => {
    setToast({ message, type, duration });
  };

  const hideToast = () => {
    setToast({ message: "", type: "info" });
  };

  return {
    toast: toast.message ? (
      <Toast
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        onClose={hideToast}
      />
    ) : null,
    showToast,
    hideToast,
  };
}

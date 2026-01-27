import { useEffect, useCallback } from "react";

/**
 * Custom hook for essential keyboard shortcuts.
 * Implements:
 * - "/" → Focus search input (if available)
 * - "Esc" → Close modals/sidebars (via callback)
 *
 * Usage:
 *   const { handleCloseModal } = useKeyboardShortcuts();
 *   // In your component, use handleCloseModal when Esc is pressed
 */
export function useKeyboardShortcuts() {
  const handleCloseModal = useCallback(() => {
    // Dispatch custom event that modals can listen to
    window.dispatchEvent(new CustomEvent("keyboard-close-modal"));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        event.target.matches("input") ||
        event.target.matches("textarea") ||
        event.target.matches("select")
      ) {
        // Allow Esc even when typing (for canceling)
        if (event.key !== "Escape") {
          return;
        }
      }

      switch (event.key) {
        case "/":
          // Focus search input if available
          event.preventDefault();
          const searchInput = document.querySelector('input[placeholder*="Search"], input[placeholder*="search"]');
          if (searchInput) {
            searchInput.focus();
          }
          break;

        case "Escape":
          // Close modals
          event.preventDefault();
          handleCloseModal();
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCloseModal]);

  return { handleCloseModal };
}

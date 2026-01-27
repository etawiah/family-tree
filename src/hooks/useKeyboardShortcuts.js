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
      // Check if we're typing in an input field (more robust check for Edge compatibility)
      const isInputLike =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.target.contentEditable === "true";

      // Don't trigger shortcuts when typing in inputs
      if (isInputLike && event.key !== "Escape") {
        // Allow normal input handling - don't preventDefault()
        return;
      }

      // Only handle specific shortcuts
      if (event.key === "/") {
        // Focus search input if available
        event.preventDefault();
        const searchInput = document.getElementById("person-search");
        if (searchInput) {
          searchInput.focus();
        }
      } else if (event.key === "Escape") {
        // Close modals - only prevent default for Escape
        event.preventDefault();
        handleCloseModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCloseModal]);

  return { handleCloseModal };
}

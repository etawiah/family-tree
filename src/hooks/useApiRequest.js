import { useState, useCallback } from "react";
import { apiRequest } from "../utils/api.js";
import { useToast } from "../components/common/Toast.jsx";

/**
 * Custom hook for API requests with built-in error handling and retry logic.
 * Handles loading states, errors, and automatic retry attempts.
 *
 * Usage:
 *   const { execute, loading, error, retry, clearError } = useApiRequest();
 *   await execute("/api/people", { method: "POST", body: JSON.stringify(data) });
 */
export function useApiRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const { showToast } = useToast();

  const MAX_RETRIES = 2;

  const execute = useCallback(
    async (url, options = {}, showErrorToast = true) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiRequest(url, options);
        setRetryCount(0);
        return result;
      } catch (err) {
        const errorMessage = err.message || "An error occurred. Please try again.";
        setError(errorMessage);

        if (showErrorToast) {
          showToast(errorMessage, "error");
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const retry = useCallback(
    async (url, options = {}, showErrorToast = true) => {
      if (retryCount >= MAX_RETRIES) {
        setError(
          "Maximum retry attempts reached. Please check your connection and try again."
        );
        if (showErrorToast) {
          showToast(
            "Maximum retry attempts reached. Please try again later.",
            "error"
          );
        }
        return null;
      }

      setRetryCount((prev) => prev + 1);
      try {
        const result = await execute(url, options, showErrorToast);
        setError(null);
        if (showErrorToast) {
          showToast("Request successful", "success");
        }
        return result;
      } catch (err) {
        // Error already handled in execute
        return null;
      }
    },
    [retryCount, execute, showToast]
  );

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    execute,
    loading,
    error,
    retry,
    clearError,
    retryCount,
  };
}

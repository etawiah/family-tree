import { getToken, logout } from "../services/auth.js";

/**
 * Retry failed API requests with exponential backoff.
 * Only retries on network errors or 5xx server errors.
 * Does NOT retry on 4xx client errors (those are permanent failures).
 */
async function retryRequest(fetchFn, options = {}) {
  const MAX_RETRIES = 3;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchFn();

      // Don't retry on client errors (4xx) - they're permanent failures
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx)
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        if (import.meta.env.DEV) {
          console.log(`[API Retry] Attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`, {
            status: response.status,
            url: options.url,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      // Network error - retry if we haven't exceeded max attempts
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        if (import.meta.env.DEV) {
          console.log(`[API Retry] Network error, attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`, {
            error: error.message,
            url: options.url,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("Request failed after maximum retries");
}

/**
 * Centralized API error handling with user-friendly messages.
 * Includes automatic retry logic for transient failures.
 */
export async function apiRequest(url, options = {}) {
  const baseUrl = import.meta.env.VITE_API_URL;
  const token = getToken();

  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await retryRequest(
      () =>
        fetch(`${baseUrl}${url}`, {
          ...options,
          headers: {
            ...defaultHeaders,
            ...options.headers,
          },
        }),
      { url }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Handle token expiration: 401 with existing token means it expired
      if (response.status === 401 && getToken() !== null) {
        logout();
        window.dispatchEvent(new CustomEvent("token-expired"));
        throw new Error("Your session has expired. Please log in again.");
      }

      const errorMessage = getUserFriendlyError(response.status, data?.error);
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    if (error.message) {
      throw error;
    }
    // Network or other errors
    throw new Error("Connection lost. Please check your internet and try again.");
  }
}

/**
 * Convert technical error codes to user-friendly, actionable messages.
 * Provides specific guidance based on error type.
 */
function getUserFriendlyError(status, technicalError) {
  const messages = {
    400: technicalError || "Invalid information. Please check your input and try again.",
    401: "Your session has expired. Please log in again.",
    403: "You don't have permission to perform this action.",
    404: "Item not found. It may have been deleted.",
    409: "This already exists. Please check for duplicates.",
    413: "File too large. Maximum size is 1MB.",
    415: "Invalid file type. Please use JPEG, PNG, or WebP.",
    429: "Too many requests. Please wait a moment and try again.",
    500: "Server error. Please try again later.",
    502: "The server is temporarily unavailable. Please try again.",
    503: "Service is temporarily unavailable. Please try again later.",
  };

  // Return specific message or fallback to technical error or generic message
  if (messages[status]) {
    return messages[status];
  }

  if (technicalError) {
    return technicalError;
  }

  // Generic fallback based on status code range
  if (status >= 500) {
    return "Server error. Please try again later.";
  }

  if (status >= 400) {
    return "Request failed. Please check your input and try again.";
  }

  return "Something went wrong. Please try again.";
}

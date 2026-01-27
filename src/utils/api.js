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
 * Convert technical error codes to user-friendly messages.
 */
function getUserFriendlyError(status, technicalError) {
  switch (status) {
    case 400:
      return technicalError || "Invalid information. Please check your input and try again.";
    case 401:
      return "Your session has expired. Please log in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "Item not found. It may have been deleted.";
    case 500:
      return "Server error. Please try again later.";
    default:
      return technicalError || "Something went wrong. Please try again.";
  }
}

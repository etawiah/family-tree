import { getToken } from "../services/auth.js";

/**
 * Centralized API error handling with user-friendly messages.
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
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
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

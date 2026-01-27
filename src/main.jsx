import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./styles/index.css";

// Configure React Query once so all API calls share consistent defaults.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data briefly to avoid refetching on every navigation.
      staleTime: 5 * 60 * 1000,
      // Retry failed requests up to 3 times with exponential backoff
      // This improves reliability on unstable connections
      retry: 3,
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s, 8s (capped at 30s)
        return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
      },
    },
  },
});

// Bootstrap the React application with routing and data fetching context.
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

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
      // Keep retries minimal for a snappy UI during early development.
      retry: 1,
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

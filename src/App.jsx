import { Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LoginForm from "./components/auth/LoginForm.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import FamilyTreeView from "./components/tree/FamilyTreeView.jsx";
import ProtectedRoute from "./utils/ProtectedRoute.jsx";
import AddPersonPage from "./components/person/AddPersonPage.jsx";
import AppHeader from "./components/layout/AppHeader.jsx";
import EditPersonPage from "./components/person/EditPersonPage.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import OfflineBanner from "./components/common/OfflineBanner.jsx";
import { useToast } from "./components/common/Toast.jsx";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { isAuthenticated } from "./services/auth.js";

// Home page - smart redirect based on authentication status
const Home = () => {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Simulate a brief check (authentication status is synchronous, but this ensures smooth transition)
    const timer = setTimeout(() => setIsChecking(false), 0);
    return () => clearTimeout(timer);
  }, []);

  if (isChecking) {
    return (
      <section className="page">
        <p>Loading...</p>
      </section>
    );
  }

  return isAuthenticated() ? <Navigate to="/tree" replace /> : <Navigate to="/login" replace />;
};

const NotFound = () => (
  <section className="page">
    <h1>Page not found</h1>
    <p>Check the URL or return to the main dashboard.</p>
  </section>
);

export default function App() {
  const { toast, showToast } = useToast();
  const navigate = useNavigate();
  useKeyboardShortcuts(); // Enable essential keyboard shortcuts

  useEffect(() => {
    const handleTokenExpired = () => {
      showToast("Your session has expired. Please log in again.", "error");
      navigate("/login", { replace: true });
    };

    const handleUserLoggedOut = () => {
      showToast("Logged out successfully", "success");
    };

    window.addEventListener("token-expired", handleTokenExpired);
    window.addEventListener("user-logged-out", handleUserLoggedOut);
    return () => {
      window.removeEventListener("token-expired", handleTokenExpired);
      window.removeEventListener("user-logged-out", handleUserLoggedOut);
    };
  }, [navigate, showToast]);

  return (
    <div className="app-shell">
      <AppHeader />
      <OfflineBanner />
      {toast}
      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            {/* Placeholder routes to be replaced with real features. */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginForm />} />

            {/* View-level access: read-only tree view. */}
            <Route element={<ProtectedRoute requiredLevel="view" />}>
              <Route path="/tree" element={<FamilyTreeView />} />
            </Route>

            {/* Admin-level access: full control panels. */}
            <Route element={<ProtectedRoute requiredLevel="admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            {/* Edit-level access: create new people entries. */}
            <Route element={<ProtectedRoute requiredLevel="edit" />}>
              <Route path="/people/new" element={<AddPersonPage />} />
              <Route path="/people/:id/edit" element={<EditPersonPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

import { Link, Route, Routes } from "react-router-dom";
import LoginForm from "./components/auth/LoginForm.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import FamilyTreeView from "./components/tree/FamilyTreeView.jsx";
import ProtectedRoute from "./utils/ProtectedRoute.jsx";

// Simple placeholder routes to validate navigation and layout wiring.
const Home = () => (
  <section className="page">
    <h1>Family Tree App</h1>
    <p>
      This starter view confirms the Vite + React setup is working. Replace
      this with the tree visualization and onboarding flow.
    </p>
  </section>
);

const NotFound = () => (
  <section className="page">
    <h1>Page not found</h1>
    <p>Check the URL or return to the main dashboard.</p>
  </section>
);

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Family Tree</div>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/tree">Tree</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>

      <main className="app-main">
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

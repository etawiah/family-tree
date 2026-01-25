import { Link, Route, Routes } from "react-router-dom";

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
          <Route
            path="/tree"
            element={
              <section className="page">
                <h1>Tree View</h1>
                <p>Wire in `react-d3-tree` once data is available.</p>
              </section>
            }
          />
          <Route
            path="/admin"
            element={
              <section className="page">
                <h1>Admin Panel</h1>
                <p>Manage users, roles, and audit logs from here.</p>
              </section>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

import { Route, Routes } from "react-router-dom";
import LoginForm from "./components/auth/LoginForm.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import FamilyTreeView from "./components/tree/FamilyTreeView.jsx";
import ProtectedRoute from "./utils/ProtectedRoute.jsx";
import AddPersonPage from "./components/person/AddPersonPage.jsx";
import AppHeader from "./components/layout/AppHeader.jsx";
import EditPersonPage from "./components/person/EditPersonPage.jsx";

// Home page - redirects to tree or shows welcome message.
const Home = () => (
  <section className="page">
    <h1>E. Tawiah Family Tree</h1>
    <p>Welcome to the family tree application.</p>
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
      <AppHeader />

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

          {/* Edit-level access: create new people entries. */}
          <Route element={<ProtectedRoute requiredLevel="edit" />}>
            <Route path="/people/new" element={<AddPersonPage />} />
            <Route path="/people/:id/edit" element={<EditPersonPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { getAccessLevel, hasRequiredAccess, isAuthenticated, logout } from "../../services/auth.js";

/**
 * App-wide header with navigation, role indicator, and logout action.
 */
export default function AppHeader() {
  const navigate = useNavigate();
  const isLoggedIn = isAuthenticated();
  const accessLevel = getAccessLevel();

  const handleLogout = () => {
    logout();
    // Navigate directly to login page and replace history to prevent back button issues
    navigate("/login", { replace: true });
    // Small delay to ensure navigation completes before dispatch
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("user-logged-out"));
    }, 0);
  };

  return (
    <header className="app-header">
      <div className="brand">E. Tawiah Family Tree</div>
      <nav className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/tree">Tree</Link>
        {hasRequiredAccess(accessLevel, "edit") ? (
          <Link to="/people/new">Add Person</Link>
        ) : null}
        {hasRequiredAccess(accessLevel, "admin") ? (
          <Link to="/admin">Admin</Link>
        ) : null}
      </nav>
      <div className="header-actions">
        {isLoggedIn ? (
          <>
            <span className="role-indicator">
              Role: {accessLevel || "unknown"}
            </span>
            <button type="button" className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}

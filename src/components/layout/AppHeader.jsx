import { Link, useNavigate } from "react-router-dom";
import { getAccessLevel, isAuthenticated, logout } from "../../services/auth.js";

/**
 * App-wide header with navigation, role indicator, and logout action.
 */
export default function AppHeader() {
  const navigate = useNavigate();
  const isLoggedIn = isAuthenticated();
  const accessLevel = getAccessLevel();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="app-header">
      <div className="brand">E. Tawiah Family Tree</div>
      <nav className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/tree">Tree</Link>
        <Link to="/admin">Admin</Link>
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

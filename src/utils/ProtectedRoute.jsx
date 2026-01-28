import { Navigate, Outlet } from "react-router-dom";
import { getAccessLevel, hasRequiredAccess, isAuthenticated } from "../services/auth.js";

/**
 * Protect routes based on authentication and access level.
 *
 * Usage:
 * <Route element={<ProtectedRoute requiredLevel="edit" />} />
 */
export default function ProtectedRoute({ requiredLevel }) {
  console.log("[ProtectedRoute] Checking access for requiredLevel:", requiredLevel);

  if (!isAuthenticated()) {
    console.log("[ProtectedRoute] NOT authenticated - redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  const userLevel = getAccessLevel();
  console.log("[ProtectedRoute] User access level from localStorage:", userLevel);
  console.log("[ProtectedRoute] Has required access?", hasRequiredAccess(userLevel, requiredLevel));

  if (!hasRequiredAccess(userLevel, requiredLevel)) {
    console.log("[ProtectedRoute] Insufficient access level. User:", userLevel, "Required:", requiredLevel, "- redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  console.log("[ProtectedRoute] Access granted - rendering Outlet");
  return <Outlet />;
}

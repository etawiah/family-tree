import { Navigate, Outlet } from "react-router-dom";
import { getAccessLevel, hasRequiredAccess, isAuthenticated } from "../services/auth.js";

/**
 * Protect routes based on authentication and access level.
 *
 * Usage:
 * <Route element={<ProtectedRoute requiredLevel="edit" />} />
 */
export default function ProtectedRoute({ requiredLevel }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const userLevel = getAccessLevel();
  if (!hasRequiredAccess(userLevel, requiredLevel)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

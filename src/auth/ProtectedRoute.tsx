import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { AppRole } from "@/auth/authTypes";
import { getDefaultRouteForRole } from "@/auth/routeUtils";

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RequireRole({ role }: { role: AppRole }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
}

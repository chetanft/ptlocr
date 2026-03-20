import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LoginFormPanel } from "@/components/auth/LoginFormPanel";
import { ProductShowcase } from "@/components/auth/ProductShowcase";
import { useAuth } from "@/auth/AuthContext";
import { getDefaultRouteForRole } from "@/auth/routeUtils";
import type { LoginCredentials } from "@/auth/authTypes";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    navigate(getDefaultRouteForRole(user.role), { replace: true });
  }, [isAuthenticated, navigate, user]);

  const handleSubmit = async (credentials: LoginCredentials) => {
    await login(credentials);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        backgroundColor: "var(--bg-primary)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <LoginFormPanel
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        onClearError={clearError}
      />
      <ProductShowcase />
    </div>
  );
}

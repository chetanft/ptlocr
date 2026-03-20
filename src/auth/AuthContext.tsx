import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, LoginCredentials } from "@/auth/authTypes";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const STORAGE_KEY = "ft-epod-auth-user";

const MOCK_USERS: Array<AuthUser & { password: string }> = [
  {
    id: "transporter-mec",
    name: "MEC Transport Desk",
    email: "epod@mec.com",
    password: "password123",
    role: "Transporter",
    companyName: "MEC",
    companyDisplayName: "MEC",
    companyLogoSrc: "/assets/mec-logo.svg",
    location: "Transporter Portal",
  },
  {
    id: "transporter-om-logistics",
    name: "OM Logistics Transport Desk",
    email: "epod@omlogistics.com",
    password: "password123",
    role: "Transporter",
    companyName: "Om Logistics",
    companyDisplayName: "Om Logistics",
    companyLogoSrc: "/assets/om-logistics-logo.svg",
    location: "Transporter Portal",
  },
  {
    id: "transporter-safeexpress",
    name: "Safexpress Transport Desk",
    email: "epod@safeexpress.com",
    password: "password123",
    role: "Transporter",
    companyName: "Safexpress",
    companyDisplayName: "Safexpress",
    companyLogoSrc: "/assets/safexpress-logo.svg",
    location: "Transporter Portal",
  },
  {
    id: "ops-mdc",
    name: "MDC Labs Ops",
    email: "ops@mdclabs.com",
    password: "password123",
    role: "Ops",
    companyName: "MDC Labs",
    companyDisplayName: "MDC Labs",
    companyLogoName: "mdc-labs",
    location: "Consignor Ops",
  },
  {
    id: "reviewer-mdc",
    name: "MDC Labs Reviewer",
    email: "reviewer@mdclabs.com",
    password: "password123",
    role: "Reviewer",
    companyName: "MDC Labs",
    companyDisplayName: "MDC Labs",
    companyLogoName: "mdc-labs",
    location: "Consignor Review",
  },
];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function migrateStoredUser(stored: AuthUser): AuthUser {
  if (
    stored.companyName === "MDC Labs" ||
    stored.companyDisplayName === "MDC Labs" ||
    stored.companyLogoSrc?.includes("mdc-labs")
  ) {
    return {
      ...stored,
      companyLogoName: "mdc-labs",
      companyLogoSrc: undefined,
    };
  }
  return stored;
}

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as AuthUser;
    const migrated = migrateStoredUser(stored);
    if (migrated !== stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    const normalizedUsername = credentials.username.trim().toLowerCase();
    const matchedUser = MOCK_USERS.find(
      (candidate) =>
        candidate.role === credentials.role &&
        candidate.email.toLowerCase() === normalizedUsername &&
        candidate.password === credentials.password,
    );

    await new Promise((resolve) => window.setTimeout(resolve, 250));

    if (!matchedUser) {
      setError("Use the mapped mock credentials for the selected role.");
      setIsLoading(false);
      throw new Error("Invalid credentials");
    }

    const nextUser: AuthUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      companyName: matchedUser.companyName,
      companyDisplayName: matchedUser.companyDisplayName,
      companyLogoName: matchedUser.companyLogoName,
      companyLogoSrc: matchedUser.companyLogoSrc,
      location: matchedUser.location,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      logout,
      clearError,
    }),
    [user, isLoading, error, login, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Alert,
  Button,
  Divider,
  Icon,
  Input,
  InputError,
  InputField,
  InputLabel,
  SegmentedTabItem,
  SegmentedTabs,
  Switch,
  SwitchInput,
  SwitchLabel,
  Typography,
} from "ft-design-system";
import type { AppRole, LoginCredentials } from "@/auth/authTypes";
import { rem14 } from "@/lib/rem";

interface LoginFormPanelProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

const ROLE_VALUES: AppRole[] = ["Transporter", "Ops", "Reviewer"];

const DEFAULT_ROLE_EMAILS: Record<AppRole, string> = {
  Transporter: "epod@mec.com",
  Ops: "ops@mdclabs.com",
  Reviewer: "reviewer@mdclabs.com",
};

const ROLE_HINTS: Record<AppRole, string[]> = {
  Transporter: ["epod@mec.com", "epod@omlogistics.com", "epod@safeexpress.com"],
  Ops: ["ops@mdclabs.com"],
  Reviewer: ["reviewer@mdclabs.com"],
};

export function LoginFormPanel({
  onSubmit,
  isLoading,
  error,
  onClearError,
}: LoginFormPanelProps) {
  const [formData, setFormData] = useState<LoginCredentials>({
    username: DEFAULT_ROLE_EMAILS.Transporter,
    password: "password123",
    role: "Transporter",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    if (formData.role === "Transporter") return "Transporter";
    if (formData.role === "Ops") return "Ops";
    return "Reviewer";
  }, [formData.role]);

  const handleRoleChange = (value: string) => {
    const role = value as AppRole;
    setFormData({
      role,
      username: DEFAULT_ROLE_EMAILS[role],
      password: "password123",
    });
    setFormError(null);
    onClearError();
  };

  const handleFieldChange =
    (field: "username" | "password") => (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((previous) => ({ ...previous, [field]: event.target.value }));
      setFormError(null);
      if (error) onClearError();
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!formData.username.trim() || !formData.password.trim()) {
      setFormError("Email and password are required.");
      return;
    }

    await onSubmit(formData);
  };

  return (
    <div
      style={{
        width: rem14(456),
        minWidth: rem14(456),
        height: "100vh",
        backgroundColor: "var(--bg-primary)",
        boxShadow: "12px 0px 24px 0px var(--secondary-200)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: `${rem14(48)} ${rem14(48)} ${rem14(24)}`,
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: rem14(32) }}>
        <div style={{ height: rem14(45), width: rem14(237), display: "flex", alignItems: "center" }}>
          <img
            src="/assets/freight-tiger-logo.svg"
            alt="Freight Tiger"
            style={{ height: "100%", width: "100%", objectFit: "contain" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: rem14(16) }}>
          <Typography variant="display-primary" color="primary">
            Log In to your Account As
          </Typography>

          <SegmentedTabs
            value={formData.role}
            onChange={handleRoleChange}
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderRadius: rem14(8),
              padding: `${rem14(8)} ${rem14(9)}`,
              height: rem14(48),
            }}
          >
            {ROLE_VALUES.map((role) => (
              <SegmentedTabItem key={role} value={role} label={role} />
            ))}
          </SegmentedTabs>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: rem14(32),
            width: rem14(360),
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: rem14(20) }}>
            <Alert variant="info">
              Sign in as {roleLabel} with {ROLE_HINTS[formData.role].join(", ")} / `password123`
            </Alert>

            <Input size="lg" variant="default">
              <InputLabel>Email or Phone Number</InputLabel>
              <InputField
                type="text"
                placeholder="eg. someone@email.com"
                value={formData.username}
                onChange={handleFieldChange("username")}
                disabled={isLoading}
                autoFocus
              />
              {formError ? <InputError>{formError}</InputError> : null}
            </Input>

            <Input size="lg" variant="default">
              <InputLabel>Password</InputLabel>
              <InputField
                type={showPassword ? "text" : "password"}
                placeholder="**************"
                value={formData.password}
                onChange={handleFieldChange("password")}
                disabled={isLoading}
                trailingIconClassName="pointer-events-auto"
                trailingIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Icon name={showPassword ? "eye-invisible" : "preview"} size={16} />
                  </button>
                }
              />
            </Input>
          </div>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: rem14(16),
            }}
          >
            <Switch size="md">
              <SwitchInput
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <SwitchLabel>Remember me</SwitchLabel>
            </Switch>

            <Button variant="link" style={{ padding: 0, height: "auto" }}>
              Forgot password?
            </Button>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={isLoading}>
            Sign In
          </Button>

          <Divider />

          <div style={{ display: "flex", flexDirection: "column", gap: rem14(16) }}>
            <Typography variant="body-primary-medium" color="primary" style={{ textAlign: "center" }}>
              Sign In with OTP
            </Typography>

            <Button variant="secondary" size="lg">
              <img
                src="/assets/google-icon.png"
                alt="Google"
                style={{ width: rem14(20), height: rem14(20), marginRight: rem14(12) }}
              />
              Sign in with Google
            </Button>

            <Button variant="secondary" size="lg">
              <img
                src="/assets/microsoft-logo.png"
                alt="Microsoft"
                style={{ width: rem14(20), height: rem14(20), marginRight: rem14(12) }}
              />
              Sign in with Microsoft
            </Button>
          </div>
        </form>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: rem14(24), alignItems: "center" }}>
        <Button variant="link">Need help with account?</Button>
        <Typography variant="body-small" color="secondary">
          © Freight Tiger 2024
        </Typography>
      </div>
    </div>
  );
}

import { useState, type ChangeEvent, type FormEvent } from "react";
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

type LoginPersona = "Shipper" | "Transporter";

const PERSONA_VALUES: LoginPersona[] = ["Shipper", "Transporter"];

const DEFAULT_ROLE_EMAILS: Record<AppRole, string> = {
  Transporter: "epod@mec.com",
  Ops: "ops@mdclabs.com",
  Reviewer: "reviewer@mdclabs.com",
};

const PERSONA_DEFAULT_EMAILS: Record<LoginPersona, string> = {
  Shipper: DEFAULT_ROLE_EMAILS.Ops,
  Transporter: DEFAULT_ROLE_EMAILS.Transporter,
};

const PERSONA_HINTS: Record<LoginPersona, string[]> = {
  Shipper: [DEFAULT_ROLE_EMAILS.Ops, DEFAULT_ROLE_EMAILS.Reviewer],
  Transporter: ["epod@mec.com", "epod@omlogistics.com", "epod@safeexpress.com"],
};

function resolveRoleFromPersona(persona: LoginPersona, username: string): AppRole {
  if (persona === "Transporter") {
    return "Transporter";
  }

  return username.trim().toLowerCase() === DEFAULT_ROLE_EMAILS.Reviewer.toLowerCase()
    ? "Reviewer"
    : "Ops";
}

export function LoginFormPanel({
  onSubmit,
  isLoading,
  error,
  onClearError,
}: LoginFormPanelProps) {
  const [selectedPersona, setSelectedPersona] = useState<LoginPersona>("Shipper");
  const [formData, setFormData] = useState<LoginCredentials>({
    username: DEFAULT_ROLE_EMAILS.Ops,
    password: "password123",
    role: "Ops",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const handleRoleChange = (value: string) => {
    const persona = value as LoginPersona;
    const role = persona === "Transporter" ? "Transporter" : "Ops";
    setSelectedPersona(persona);
    setFormData({
      role,
      username: PERSONA_DEFAULT_EMAILS[persona],
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

    await onSubmit({
      ...formData,
      role: resolveRoleFromPersona(selectedPersona, formData.username),
    });
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
            value={selectedPersona}
            onChange={handleRoleChange}
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderRadius: rem14(8),
              padding: `${rem14(8)} ${rem14(9)}`,
              height: rem14(48),
            }}
          >
            {PERSONA_VALUES.map((persona) => (
              <SegmentedTabItem key={persona} value={persona} label={persona} />
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
              Sign in as {selectedPersona} with {PERSONA_HINTS[selectedPersona].join(", ")} / `password123`
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

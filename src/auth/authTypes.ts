import type { LogoName } from "ft-design-system";

export type AppRole = "Transporter" | "Ops" | "Reviewer";

export interface LoginCredentials {
  username: string;
  password: string;
  role: AppRole;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  companyName: string;
  companyDisplayName: string;
  companyLogoName?: LogoName;
  companyLogoSrc?: string;
  location?: string;
}

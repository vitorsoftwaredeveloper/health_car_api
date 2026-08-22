export type Role = "owner" | "admin";

export interface AuthClaims {
  sub: string;
  email: string;
  groups: Role[];
  role: Role;
}

export type AccessLevel = "read" | "write" | "manage";

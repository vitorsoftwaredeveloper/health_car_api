import { AuthClaims, Role } from "../types/auth";
import { httpError, STATUS_CODE } from "../utils/errors";

const ROLES: Role[] = ["owner", "driver", "admin"];

const isRole = (value: string): value is Role =>
  (ROLES as string[]).includes(value);

export const parseGroupsClaim = (raw: string | undefined): Role[] => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is Role => isRole(value));
    }
  } catch {

  }

  return raw
    .replace(/[[\]]/g, "")
    .split(",")
    .map((value) => value.trim())
    .filter(isRole);
};

const isDevFallbackAllowed = (): boolean => {
  const stage = (process.env.STAGE || "").toLowerCase();
  return stage === "dev" || stage === "local" || stage === "";
};

export const getAuthClaims = (event: any): AuthClaims | null => {
  const claims = event?.requestContext?.authorizer?.jwt?.claims as
    | Record<string, string>
    | undefined;

  if (claims?.sub) {
    const groups = parseGroupsClaim(claims["cognito:groups"]);
    const role = groups[0];
    if (!role) return null;

    return { sub: claims.sub, email: claims.email ?? "", groups, role };
  }

  if (isDevFallbackAllowed()) {
    const headers = event?.headers ?? {};
    const sub = headers["x-dev-sub"] ?? headers["X-Dev-Sub"];
    const roleHeader = headers["x-dev-role"] ?? headers["X-Dev-Role"];
    const email = headers["x-dev-email"] ?? headers["X-Dev-Email"] ?? "";

    if (sub && roleHeader && isRole(roleHeader)) {
      return { sub, email, groups: [roleHeader], role: roleHeader };
    }
  }

  return null;
};

export const requireAuthClaims = (event: any): AuthClaims => {
  const auth = getAuthClaims(event);
  if (!auth) {
    throw httpError(
      STATUS_CODE.UNAUTHORIZED,
      "UNAUTHENTICATED",
      "Token ausente ou inválido.",
    );
  }
  return auth;
};

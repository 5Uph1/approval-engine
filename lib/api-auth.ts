import { JWTPayload } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { JwtPayload, verifyToken } from "./auth";

export const AUTH_COOKIE = "token";

export async function getAuthUser(
  req: NextRequest,
): Promise<JwtPayload | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : req.cookies.get(AUTH_COOKIE)?.value;

  if (!token) return null;
  return verifyToken(token);
}

type AuthResult =
  | { user: JWTPayload; error?: undefined }
  | { error: NextResponse; user?: undefined };

export async function requireAuth(
  req: NextRequest,
  allowedRoles?: string[],
): Promise<AuthResult> {
  const user = await getAuthUser(req);

  if (!user) {
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (
    allowedRoles?.length &&
    !allowedRoles.some((r) => user.roles.includes(r))
  ) {
    return {
      error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }
  return { user };
}

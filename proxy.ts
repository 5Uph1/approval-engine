import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "./lib/api-auth";

// Endpoint yang boleh diakses tanpa login
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
];

const ROLE_PROTECTED: {
  prefix: string;
  roles: string[];
}[] = [{ prefix: "/api/admin", roles: ["Admin"] }];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") {
    const user = await getAuthUser(req);
    return NextResponse.redirect(
      new URL(user ? "/dashboard" : "/auth/login", req.url),
    );
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rule = ROLE_PROTECTED.find((r) => pathname.startsWith(r.prefix));

  if (rule && !rule.roles.some((role) => user.roles.includes(role))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/"],
};

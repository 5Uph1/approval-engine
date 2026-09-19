import { AUTH_COOKIE } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export function POST() {
  const res = NextResponse.json({ message: "Logout berhasil" });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

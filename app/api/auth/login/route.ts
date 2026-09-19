import { AUTH_COOKIE } from "@/lib/api-auth";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(req: NextRequest) {
  const body = loginSchema.safeParse(await req.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json(
      {
        message: "Validasi gagal",
        errors: body.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { email, password } = body.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    return NextResponse.json(
      { messge: "Email atau password salah" },
      { status: 401 },
    );
  }

  const passwordHash = await bcrypt.compare(password, user.passwordHash);

  if (!passwordHash) {
    return NextResponse.json(
      { messge: "Email atau password salah" },
      { status: 401 },
    );
  }

  const roles = user.userRoles.map((ur) => ur.role.name);
  const token = await signToken({ sub: user.id, email: user.email, roles });

  const res = NextResponse.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, roles },
  });

  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return res;
}

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const registerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export async function POST(req: NextRequest) {
  const body = registerSchema.safeParse(await req.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json(
      {
        message: "validasi gagal",
        errors: body.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { name, email, password } = body.data;

  // Cek apakah user sudah ada atau belum
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { message: "Email sudah terdaftar" },
      {
        status: 409,
      },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      userRoles: { create: { role: { connect: { name: "Employee" } } } },
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
